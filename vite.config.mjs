import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { apolloApiPlugin } from "./server/apollo-api-plugin.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "APOLLO_");
  if (!process.env.APOLLO_API_KEY && env.APOLLO_API_KEY) {
    process.env.APOLLO_API_KEY = env.APOLLO_API_KEY;
  }

  return {
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), apolloApiPlugin()],
  };
});
