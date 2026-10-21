import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { dataProviderApiPlugin } from "./server/data-provider-plugin.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "PROSPECT_DATA_");
  if (!process.env.PROSPECT_DATA_API_KEY && env.PROSPECT_DATA_API_KEY) {
    process.env.PROSPECT_DATA_API_KEY = env.PROSPECT_DATA_API_KEY;
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
  plugins: [react(), dataProviderApiPlugin()],
  };
});
