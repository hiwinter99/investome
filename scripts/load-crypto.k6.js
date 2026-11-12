import http from "k6/http";
import { check, fail } from "k6";
import { Counter } from "k6/metrics";

const mode = __ENV.MODE || "single";
if (!["single", "balanced"].includes(mode)) throw new Error("MODE must be single or balanced");
const base = mode === "single" ? "http://127.0.0.1:18081" : "http://127.0.0.1:18080";
const a = new Counter("backend_a_responses");
const b = new Counter("backend_b_responses");
const retried = new Counter("backend_retries");

export const options = {
  scenarios: {
    warm_cache: { executor: "constant-vus", vus: 20, duration: "30s", gracefulStop: "5s" },
  },
  thresholds: {
    "http_req_failed{phase:load}": ["rate<0.01"],
    "checks{phase:load}": ["rate==1"],
    ...(mode === "balanced" ? {
      backend_a_responses: ["count>0"],
      backend_b_responses: ["count>0"],
      backend_retries: ["count==0"],
    } : {}),
  },
};

function valid(response) {
  try {
    const items = response.json("items");
    return response.status === 200 && Array.isArray(items) && items.length > 0
      && items.every(item => item && typeof item.symbol === "string");
  } catch { return false; }
}

export function setup() {
  // Preflight B as well: failover to A alone must not masquerade as a two-server test.
  const ports = mode === "single" ? [18081] : [18081, 18082];
  for (const port of ports) {
    const response = http.get(`http://127.0.0.1:${port}/api/crypto-top30`, {
      timeout: "60s", tags: { phase: "setup" },
    });
    if (!valid(response)) fail(`Server ${port} unavailable or coin list empty; start both servers and check Redis/upstream.`);
  }
  console.log(`${mode}: 20 virtual users, 30 seconds, continuous requests, warm coin cache.`);
}

export default function () {
  const response = http.get(`${base}/api/crypto-top30`, {
    timeout: "5s", tags: { phase: "load" },
  });
  check(response, { "200 with non-empty coin list": valid }, { phase: "load" });
  if (mode === "balanced") {
    const backend = response.headers["X-Backend"] || "";
    const retry = backend.includes(",");
    retried.add(retry ? 1 : 0);
    a.add(!retry && backend.endsWith(":18081") ? 1 : 0);
    b.add(!retry && backend.endsWith(":18082") ? 1 : 0);
  }
}
