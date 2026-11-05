import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

// Change this number to practice Redis expiration. Production defaults stay unchanged.
const PRACTICE_TTL_SECONDS = 30;

process.env.REDIS_URL ||= "redis://127.0.0.1:6379";
process.env.CRYPTO_CACHE_KEY = `investome:experiment:expiry:${randomUUID()}`;
const { redisCommand, closeCryptoRedis, cryptoCacheKey } = await import("../lib/crypto-redis.mjs");
let child;
try {
  await redisCommand(client => client.ping());
  child = fork(new URL("./crypto-cache-worker.mjs", import.meta.url), [], {
    env: { ...process.env, EXPERIMENT_SERVER: "practice", CRYPTO_CACHE_TTL_SECONDS: String(PRACTICE_TTL_SECONDS) },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timeout")), 10000);
    child.once("message", message => { clearTimeout(timer); resolve(message); });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", () => { clearTimeout(timer); reject(new Error("Server stopped")); });
  });
  async function request(label, expectedCalls) {
    const response = await fetch(`http://127.0.0.1:${ready.port}/api/crypto-top30`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.items?.length, 30);
    assert.equal(body.experiment.upstreamCalls, expectedCalls);
    const ttl = await redisCommand(client => client.ttl(cryptoCacheKey));
    assert.ok(ttl > 0 && ttl <= PRACTICE_TTL_SECONDS);
    console.log(`${label}: external calls so far = ${expectedCalls}, Redis TTL = ${ttl}s`);
  }
  console.log(`Practice only: ${PRACTICE_TTL_SECONDS}s TTL, synthetic coins, isolated Redis key.`);
  await request("1. First request: fetch and store", 1);
  await request("2. Immediate request: reuse Redis", 1);
  console.log(`Waiting ${PRACTICE_TTL_SECONDS + 1} real seconds for Redis expiration...`);
  await new Promise(resolve => setTimeout(resolve, (PRACTICE_TTL_SECONDS + 1) * 1000));
  assert.equal(await redisCommand(client => client.get(cryptoCacheKey)), null);
  console.log("Redis key has actually expired.");
  await request("3. After expiration: fetch again", 2);
  console.log("PASS: store -> reuse -> real expiration -> refresh");
} catch (error) {
  console.error(`Practice failed (${error.code || error.name}). Check Redis is running.`);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    await new Promise(resolve => {
      const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
      if (child.connected) child.disconnect();
      else child.kill();
    });
  }
  try { await redisCommand(client => client.del(cryptoCacheKey)); } catch { /* TTL also cleans up. */ }
  await closeCryptoRedis();
}
