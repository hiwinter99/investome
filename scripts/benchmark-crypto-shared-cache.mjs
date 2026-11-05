import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";

// No load balancer yet: direct sequential A -> B requests isolate cache sharing.
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
process.env.REDIS_URL = redisUrl;
process.env.CRYPTO_CACHE_KEY = `investome:experiment:shared:${randomUUID()}`;
const { redisCommand, closeCryptoRedis, cryptoCacheKey } = await import("../lib/crypto-redis.mjs");
const children = [];
const rows = [];

async function start(name, mode) {
  const env = { ...process.env, EXPERIMENT_SERVER: name };
  if (mode === "memory") delete env.REDIS_URL;
  const child = fork(new URL("./crypto-cache-worker.mjs", import.meta.url), [], {
    env, stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  children.push(child);
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server ${name} startup timeout`)), 10000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`Server ${name} exited: ${code}`)); });
    child.once("message", message => { clearTimeout(timer); resolve(message); });
  });
  console.log(`${mode}: server ${name} started (PID ${ready.pid})`);
  return { child, ...ready };
}

async function request(server, mode, label) {
  const started = performance.now();
  const response = await fetch(`http://127.0.0.1:${server.port}/api/crypto-top30`, {
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.items?.length, 30);
  assert.ok(!body.stale);
  rows.push({ mode, request: label, server: body.experiment.server,
    pid: body.experiment.pid, upstreamCallsOnServer: body.experiment.upstreamCalls,
    elapsedMs: Math.round((performance.now() - started) * 100) / 100 });
  return body;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    if (child.connected) child.disconnect();
    else child.kill();
  });
}

try {
  // Fail explicitly if Redis is unavailable; do not mistake fallback for sharing.
  await redisCommand(client => client.ping());
  console.log("Synthetic coins, mocked 150ms upstream; two real local server processes per mode.");
  for (const mode of ["memory", "redis"]) {
    const a = await start("A", mode);
    const b = await start("B", mode);
    assert.notEqual(a.pid, b.pid);
    const first = await request(a, mode, "1. A first");
    const second = await request(b, mode, "2. B first");
    await request(a, mode, "3. A again");
    await request(b, mode, "4. B again");
    assert.deepEqual(first.items, second.items);
    assert.equal(first.experiment.upstreamCalls, 1);
    assert.equal(second.experiment.upstreamCalls, mode === "memory" ? 1 : 0);
    if (mode === "redis") {
      const ttl = await redisCommand(client => client.ttl(cryptoCacheKey));
      assert.ok(ttl > 0 && ttl <= 300);
    }
    await stop(a.child);
    await stop(b.child);
  }
  console.table(rows);
  console.log("PASS: memory A=1 + B=1 (2 upstream calls); Redis A=1 + B=0 (1 upstream call).");
  console.log("Sequential requests only. Simultaneous cold misses can still duplicate upstream calls across servers.");
} catch (error) {
  console.error(`Experiment failed (${error.code || error.name}). Check Redis is running and local server access is allowed.`);
  process.exitCode = 1;
} finally {
  await Promise.all(children.map(stop));
  try { await redisCommand(client => client.del(cryptoCacheKey)); } catch { /* Experiment key also expires. */ }
  await closeCryptoRedis();
}
