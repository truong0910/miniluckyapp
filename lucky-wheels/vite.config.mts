import { defineConfig } from "vite";
import zaloMiniApp from "zmp-vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default () => {
  return defineConfig({
    root: "./",
    base: "",
    plugins: [zaloMiniApp(), react()],
    server: {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
    optimizeDeps: {
      include: [
        "zmp-ui",
        "zmp-sdk",
        "react",
        "react-dom",
        "react-dom/client",
        "valibot",
        "xlsx",
      ],
      holdUntilCrawlEnd: true,
    },
    build: {
      assetsInlineLimit: 0,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  });
};
