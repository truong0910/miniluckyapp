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

console.log("[LuckyWheels Web Init]", {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  PARTICIPANT_AUTH_MODE: import.meta.env.VITE_PARTICIPANT_AUTH_MODE,
  ZALO_OA_ID: import.meta.env.VITE_ZALO_OA_ID,
  URL: window.location.href,
});

// Global error logger
window.addEventListener("error", (event) => {
  console.error("[Web Global Error]", event.error || event.message);
});

// Gracefully handle Zalo SDK login auto-auth promise rejections when running in standard web browser
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  console.warn("[Web Unhandled Rejection]", reason);
  if (
    reason &&
    typeof reason === "object" &&
    (reason.api === "login" || reason.code === -2000 || String(reason.message).includes("Unknown error"))
  ) {
    event.preventDefault();
  }
});

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[React Error Boundary Caught Error]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", background: "#0f172a", color: "#f8fafc", minHeight: "100vh", fontFamily: "sans-serif" }}>
          <div style={{ maxWidth: "500px", margin: "0 auto", background: "#1e293b", padding: "20px", borderRadius: "16px", border: "1px solid #ef4444" }}>
            <h2 style={{ color: "#ef4444", marginTop: 0 }}>⚠️ Lỗi Khởi Chạy Ứng Dụng (Web Debug Mode)</h2>
            <p style={{ fontSize: "14px", color: "#cbd5e1" }}>
              <strong>Lỗi:</strong> {this.state.error?.message || "Không xác định"}
            </p>
            <pre style={{ background: "#0f172a", padding: "10px", borderRadius: "8px", fontSize: "11px", overflowX: "auto", color: "#fca5a5" }}>
              {this.state.error?.stack || ""}
            </pre>
            <div style={{ marginTop: "15px", fontSize: "12px", color: "#94a3b8" }}>
              <div>API Base URL: {String(import.meta.env.VITE_API_BASE_URL)}</div>
              <div>Auth Mode: {String(import.meta.env.VITE_PARTICIPANT_AUTH_MODE)}</div>
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: "15px", padding: "10px 20px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
            >
              🔄 Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

declare global {
  interface Window {}
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <SnackbarProvider>
        <MiniApp />
      </SnackbarProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
