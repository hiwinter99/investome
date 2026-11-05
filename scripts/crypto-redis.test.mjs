import { test, mock } from "node:test";
import assert from "node:assert/strict";

test("Redis hit, shared reuse, refresh merging, stale fallback and outage fallback", async () => {
  process.env.REDIS_URL = "redis://test.invalid";
  const store = new Map();
  let unavailable = false;
  let upstreamFails = false;
  let upstreamCalls = 0;
  const fakeClient = {
    isReady: true, on() {}, async connect() {},
    withCommandOptions() { return this; },
    async get(key) { if (unavailable) throw new Error("offline"); return store.get(key) ?? null; },
    async set(key, value, options) {
      if (unavailable) throw new Error("offline");
      assert.equal(options.EX, 300);
      store.set(key, value);
    },
  };
  mock.module("redis", { namedExports: { createClient: () => fakeClient } });
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    upstreamCalls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return upstreamFails ? new Response("failed", { status: 503 })
      : Response.json([{ id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 100 }]);
  };
  try {
    const { default: handler } = await import("../api/crypto-top30.js");
    const request = async () => {
      let result;
      const response = { setHeader() {}, status() { return this; }, json(body) { result = body; } };
      await handler({ method: "GET" }, response);
      return result;
    };
    await request();
    assert.equal(upstreamCalls, 1);
    assert.equal(store.size, 1);
    // No process-local data: a Redis hit must restore it without upstream access.
    const cache = globalThis.__INVESTOME_CRYPTO_TOP30_CACHE__;
    cache.data = null;
    assert.equal((await request()).items[0].symbol, "BTC");
    assert.equal(upstreamCalls, 1);
    store.clear();
    await Promise.all(Array.from({ length: 10 }, request));
    assert.equal(upstreamCalls, 2);
    store.clear();
    upstreamFails = true;
    assert.equal((await request()).stale, true);
    unavailable = true;
    assert.equal((await request()).items[0].symbol, "BTC");
    assert.equal(upstreamCalls, 3); // Redis outage reused still-fresh local copy.
  } finally {
    globalThis.fetch = nativeFetch;
    mock.restoreAll();
  }
});
