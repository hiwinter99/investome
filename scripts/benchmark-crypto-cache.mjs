import http from "node:http";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";

// Exercise the real API handler, replacing only its external CoinGecko fetch.
// This is a controlled local experiment, not a production performance claim.
const nativeFetch = globalThis.fetch;
const nativeNow = Date.now;
const large = process.argv.includes("--large");
const useRedis = process.argv.includes("--redis");
const output = process.argv.slice(2).find(arg => !arg.startsWith("--"));
if (useRedis) {
  process.env.REDIS_URL ||= "redis://127.0.0.1:6379";
  process.env.CRYPTO_CACHE_KEY = `investome:experiment:crypto:${process.pid}:${Date.now()}`;
} else {
  // An inherited deployment variable must not silently change the baseline.
  delete process.env.REDIS_URL;
}
const { redisCommand, closeCryptoRedis, cryptoCacheKey } = await import("../lib/crypto-redis.mjs");
console.log(`Cache mode: ${useRedis ? "Redis (isolated experiment key)" : "memory"}`);
console.log(large
  ? "Large mode: 10,000 requests per warm phase; concurrency 1 / 10 / 50 / 100. Local synthetic data only."
  : "Small mode: local synthetic cache experiment. Add --large for 10,000 requests per warm phase.");
let clockOffset = 0;
let upstreamCalls = 0;
let upstreamFails = false;
Date.now = () => nativeNow() + clockOffset;
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  if (url.hostname !== "api.coingecko.com") throw new Error(`Unexpected upstream: ${url.hostname}`);
  upstreamCalls++;
  await new Promise(resolve => setTimeout(resolve, 150));
  if (upstreamFails) return new Response("Simulated failure", { status: 503 });
  return Response.json(Array.from({ length: 30 }, (_, i) => ({
    id: `fixture-${i + 1}`, name: `Fixture coin ${i + 1}`, symbol: `f${i + 1}`,
    market_cap_rank: i + 1, market_cap: 1000000 - i, current_price: 1000 + i,
    price_change_percentage_24h: 1, image: "",
  })));
};

delete globalThis.__INVESTOME_CRYPTO_TOP30_CACHE__;
const { default: handler } = await import("../api/crypto-top30.js");
const server = http.createServer((req, res) => {
  if (req.url !== "/api/crypto-top30") { res.writeHead(404).end(); return; }
  res.status = code => { res.statusCode = code; return res; };
  res.json = data => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); };
  Promise.resolve(handler(req, res)).catch(() => { res.statusCode = 500; res.end(); });
});

try {
  if (useRedis) await redisCommand(client => client.ping());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/api/crypto-top30`;
  const results = [];
  async function run(name, requests, concurrency, expectStale = false) {
    console.log(`Running ${name}: ${requests.toLocaleString()} requests, concurrency ${concurrency}...`);
    const before = upstreamCalls;
    const durations = [];
    let next = 0;
    let failures = 0;
    const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (next++ < requests) {
        const start = performance.now();
        try {
          const response = await nativeFetch(url, { signal: AbortSignal.timeout(5000) });
          const body = await response.json();
          if (!response.ok || body.items?.length !== 30 || Boolean(body.stale) !== expectStale) failures++;
        } catch { failures++; }
        durations.push(performance.now() - start);
      }
    }));
    const elapsed = performance.now() - started;
    durations.sort((a, b) => a - b);
    const round = n => Math.round(n * 100) / 100;
    const result = {
      name, requests, concurrency, failures, upstreamCalls: upstreamCalls - before,
      averageMs: round(durations.reduce((a, b) => a + b, 0) / durations.length),
      p95Ms: round(durations[Math.ceil(durations.length * 0.95) - 1]),
      requestsPerSecond: round(requests / (elapsed / 1000)),
    };
    results.push(result);
    console.log(`  Done: average ${result.averageMs}ms, p95 ${result.p95Ms}ms, failures ${failures}, upstream calls ${result.upstreamCalls}`);
  }
  await run("cold: empty cache", 1, 1);
  if (useRedis) {
    const raw = await redisCommand(client => client.get(cryptoCacheKey));
    const ttl = await redisCommand(client => client.ttl(cryptoCacheKey));
    if (!raw || JSON.parse(raw).items?.length !== 30 || ttl <= 0 || ttl > 300) {
      throw new Error("Redis storage / TTL verification failed");
    }
    console.log(`Redis storage verified: 30 coins, TTL ${ttl}s`);
  }
  const warmConcurrency = large ? [1, 10, 50, 100] : [1, 10];
  for (const concurrency of warmConcurrency) {
    await run(`warm: ${concurrency} concurrent`, large ? 10000 : 100, concurrency);
  }
  // Move the handler's clock forward; this does NOT measure five real minutes.
  clockOffset += 301000;
  if (useRedis) await redisCommand(client => client.del(cryptoCacheKey));
  await run("expired: 10 concurrent", 100, 10);
  clockOffset += 301000;
  if (useRedis) await redisCommand(client => client.del(cryptoCacheKey));
  upstreamFails = true;
  await run("expired + upstream failure: stale response", 1, 1, true);
  console.table(results);
  const expectedCalls = [1, ...warmConcurrency.map(() => 0), 1, 1];
  const passed = results.every((row, i) => row.failures === 0 && row.upstreamCalls === expectedCalls[i]);
  const report = {
    measuredAt: new Date().toISOString(), nodeVersion: process.version, size: large ? "large" : "small", cache: useRedis ? "redis" : "memory",
    mode: "local HTTP / real Vercel handler / synthetic 30-coin fixture / mocked 150ms upstream",
    cacheTtlSeconds: 300, expiry: useRedis ? "delete isolated Redis key + simulated memory clock advance" : "simulated clock advance", cdn: false,
    note: "Not real CoinGecko latency or production load. RPS is observed batch throughput, not server capacity. Refresh deduplication is per process, not distributed.",
    results, passed,
  };
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(passed ? "PASS: cache reuse, concurrent refresh deduplication, expiry and stale fallback verified." : "FAIL: unexpected cache behavior.");
  if (!passed) process.exitCode = 1;
} finally {
  if (useRedis) {
    try { await redisCommand(client => client.del(cryptoCacheKey)); } catch { /* Best effort; TTL also cleans up. */ }
    await closeCryptoRedis();
  }
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  globalThis.fetch = nativeFetch;
  Date.now = nativeNow;
}
