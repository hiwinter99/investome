import { cryptoCacheKey, redisEnabled, redisCommand } from "../lib/crypto-redis.mjs";

const configuredTtl = Number(process.env.CRYPTO_CACHE_TTL_SECONDS || 300);
const CACHE_TTL_MS = (Number.isInteger(configuredTtl) && configuredTtl > 0 ? configuredTtl : 300) * 1000;

const globalCache = globalThis.__INVESTOME_CRYPTO_TOP30_CACHE__ || {
  data: null,
  updatedAt: 0,
  inflight: null,
};

globalThis.__INVESTOME_CRYPTO_TOP30_CACHE__ = globalCache;

async function fetchJson(url, init) {
  const res = await fetch(url, init);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = new Error(`Crypto top30 fetch failed: ${res.status}`);
    error.status = res.status;
    error.body = text;
    throw error;
  }

  return res.json();
}

async function loadCryptoTop30() {
  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "krw");
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", "30");
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");
  url.searchParams.set("price_change_percentage", "24h");

  const headers = {
    accept: "application/json",
  };

  // CoinGecko demo/pro 키가 있으면 자동 사용
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const items = await fetchJson(url.toString(), { headers });

  if (!Array.isArray(items)) {
    throw new Error("Crypto top30 fetch failed: invalid payload");
  }

  return items.map((coin, index) => ({
    rank: Number.isFinite(Number(coin?.market_cap_rank))
      ? Number(coin.market_cap_rank)
      : index + 1,
    market: "CRYPTO",
    name: coin?.name || "-",
    displayNameEN: coin?.name || "",
    symbol: String(coin?.symbol || "-").toUpperCase(),
    iconUrl: coin?.image || "",
    coinId: coin?.id || "",
    capKRW: Number.isFinite(Number(coin?.market_cap)) ? Number(coin.market_cap) : null,
    priceKRW: Number.isFinite(Number(coin?.current_price)) ? Number(coin.current_price) : null,
    changePct: Number.isFinite(Number(coin?.price_change_percentage_24h))
      ? Number(coin.price_change_percentage_24h)
      : null,
  }));
}

async function getCryptoTop30Cached() {
  const now = Date.now();
  let redisAvailable = false;
  if (redisEnabled) {
    try {
      const raw = await redisCommand(client => client.get(cryptoCacheKey));
      redisAvailable = true;
      if (raw) {
        const entry = JSON.parse(raw);
        if (Array.isArray(entry.items) && entry.items.length > 0 && Number.isFinite(entry.updatedAt)) {
          globalCache.data = entry.items;
          globalCache.updatedAt = entry.updatedAt;
          return entry.items;
        }
      }
    } catch {
      // Redis failure is a cache failure, not an API failure.
      redisAvailable = false;
    }
  }
  const isFresh =
    Array.isArray(globalCache.data) &&
    globalCache.data.length > 0 &&
    now - globalCache.updatedAt < CACHE_TTL_MS;

  if (isFresh && !redisAvailable) {
    return globalCache.data;
  }

  if (globalCache.inflight) {
    return globalCache.inflight;
  }

  globalCache.inflight = loadCryptoTop30()
    .then(async (items) => {
      globalCache.data = items;
      globalCache.updatedAt = Date.now();
      if (redisEnabled) {
        try {
          await redisCommand(client => client.set(cryptoCacheKey,
            JSON.stringify({ items, updatedAt: globalCache.updatedAt }), { EX: CACHE_TTL_MS / 1000 }));
        } catch {
          // Keep the successful upstream result even if Redis cannot store it.
        }
      }
      return items;
    })
    .finally(() => {
      globalCache.inflight = null;
    });

  return globalCache.inflight;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const items = await getCryptoTop30Cached();
    return res.status(200).json({ items });
  } catch (error) {
    const hasStaleCache =
      Array.isArray(globalCache.data) && globalCache.data.length > 0;

    if (hasStaleCache) {
      return res.status(200).json({ items: globalCache.data, stale: true });
    }

    return res.status(error?.status || 500).json({
      error: error?.message || "Crypto top30 fetch failed",
      stale: false,
      updatedAt: globalCache.updatedAt || null,
    });
  }
}
