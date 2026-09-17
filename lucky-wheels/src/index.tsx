// ZaUI stylesheet
import "zmp-ui/zaui.css";
// Tailwind stylesheet
import "@/css/tailwind.scss";
// Your stylesheet
import "@/css/app.scss";

// React core
import React from "react";
import { createRoot } from "react-dom/client";

// Expose app configuration
import appConfig from "../app-config.json";
import MiniApp from "./app";
import { SnackbarProvider } from "zmp-ui";

if (!window.APP_CONFIG) {
  window.APP_CONFIG = appConfig as any;
}

// Gracefully handle Zalo SDK login auto-auth promise rejections when running in standard web browser
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  if (
    reason &&
    typeof reason === "object" &&
    (reason.api === "login" || reason.code === -2000 || String(reason.message).includes("Unknown error"))
  ) {
    event.preventDefault();
  }
});

declare global {
  interface Window {}
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <SnackbarProvider>
      <MiniApp />
    </SnackbarProvider>
  </React.StrictMode>
);
