import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const springProxy = {
  target: "http://localhost:8080",
  changeOrigin: true,
  secure: false,
};

const vercelApiProxy = {
  target: "http://localhost:3000",
  changeOrigin: true,
  secure: false,
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const cryptoProxy = env.CRYPTO_BACKEND_URL
    ? { ...springProxy, target: env.CRYPTO_BACKEND_URL }
    : vercelApiProxy;
  return {
  plugins: [react()],
  server: {
    proxy: {
      "/api/crypto-top30": cryptoProxy,
      "/api/stock-top30": vercelApiProxy,
      "/api/commodity-top": vercelApiProxy,
      "/api/asset-quote": vercelApiProxy,
      "/api/asset-search": vercelApiProxy,
      "/api/ticker": vercelApiProxy,
      "/api/news": vercelApiProxy,

      "/api/auth": springProxy,
      "/api/board": springProxy,
      "/api/mypage": springProxy,
      "/api/paper": springProxy,
    },
  },
  };
});
