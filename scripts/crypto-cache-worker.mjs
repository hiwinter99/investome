import http from "node:http";

const name = process.env.EXPERIMENT_SERVER;
let upstreamCalls = 0;
globalThis.fetch = async input => {
  if (new URL(String(input)).hostname !== "api.coingecko.com") {
    throw new Error("Unexpected upstream");
  }
  upstreamCalls++;
  await new Promise(resolve => setTimeout(resolve, 150));
  return Response.json(Array.from({ length: 30 }, (_, i) => ({
    id: `fixture-${i}`, name: `Fixture ${i}`, symbol: `f${i}`,
    current_price: 100 + i, market_cap: 1000000 - i, market_cap_rank: i + 1,
  })));
};

const { default: handler } = await import("../api/crypto-top30.js");
const { closeCryptoRedis } = await import("../lib/crypto-redis.mjs");
const server = http.createServer((req, res) => {
  if (req.url !== "/api/crypto-top30") { res.writeHead(404).end(); return; }
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ...body, experiment: { server: name, pid: process.pid, upstreamCalls } }));
  };
  Promise.resolve(handler(req, res)).catch(() => { res.statusCode = 500; res.end(); });
});

process.on("disconnect", async () => {
  server.closeAllConnections();
  server.close();
  await closeCryptoRedis();
});
server.on("error", () => { console.error(`Server ${name} could not listen`); process.exit(1); });
server.listen(0, "127.0.0.1", () => {
  process.send({ port: server.address().port, pid: process.pid });
});
