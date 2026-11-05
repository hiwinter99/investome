import { createClient } from "redis";

export const cryptoCacheKey = process.env.CRYPTO_CACHE_KEY || "investome:crypto:top30:v1";
export const redisEnabled = Boolean(process.env.REDIS_URL);
let client;
let connecting;
let retryAfter = 0;

async function connection() {
  if (client?.isReady) return client;
  if (connecting) return connecting;
  if (Date.now() < retryAfter) throw new Error("Redis temporarily unavailable");
  client = createClient({
    url: process.env.REDIS_URL,
    disableOfflineQueue: true,
    socket: { connectTimeout: 1000, reconnectStrategy: false },
  });
  client.on("error", () => {}); // Commands report errors; never log credential-bearing URLs.
  connecting = client.connect().then(() => client).catch(error => {
    retryAfter = Date.now() + 10000;
    throw error;
  }).finally(() => { connecting = null; });
  return connecting;
}

export async function redisCommand(operation) {
  const connected = await connection();
  return operation(connected.withCommandOptions({ abortSignal: AbortSignal.timeout(1000) }));
}

export async function closeCryptoRedis() {
  if (client?.isOpen) client.destroy();
}
