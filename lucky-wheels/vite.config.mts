import { defineConfig } from "vite";
import zaloMiniApp from "zmp-vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  const isMiniApp = mode === "miniapp" || process.env.VITE_APP_TARGET === "miniapp";

  return defineConfig({
    root: "./",
    base: "/",
    plugins: [...(isMiniApp ? [zaloMiniApp()] : []), react()],
    define: {
      "import.meta.env.VITE_APP_TARGET": JSON.stringify(isMiniApp ? "miniapp" : "web"),
    },
    server: {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
    optimizeDeps: {
      include: [
        ...(isMiniApp ? ["zmp-ui", "zmp-sdk"] : []),
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
        "@/platform/router": path.resolve(__dirname, `./src/router.${isMiniApp ? "miniapp" : "web"}.tsx`),
        "@/platform/register-form": path.resolve(__dirname, `./src/components/register-form.${isMiniApp ? "miniapp" : "web"}.tsx`),
        "@/platform/participant-auth": path.resolve(__dirname, `./src/services/participant-auth.${isMiniApp ? "miniapp" : "web"}.ts`),
        "@/platform/app-shell": path.resolve(__dirname, `./src/platform/app-shell.${isMiniApp ? "miniapp" : "web"}.tsx`),
        "@/platform/runtime-config": path.resolve(__dirname, `./src/platform/runtime-config.${isMiniApp ? "miniapp" : "web"}.ts`),
        ...(isMiniApp ? {} : { "zmp-ui": path.resolve(__dirname, "./src/platform/ui.web.tsx") }),
        "@": path.resolve(__dirname, "./src"),
      },
    },
  });
};
