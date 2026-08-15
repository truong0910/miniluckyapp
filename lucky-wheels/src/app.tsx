import { App } from "zmp-ui";
import AppRouter from "./router";
import { syncRemoteContent } from "@/services/content.services";
import { useEffect } from "react";

export default function MiniApp() {
  useEffect(() => {
    void syncRemoteContent();
  }, []);

  return (
    <App>
      <AppRouter />
    </App>
  );
}
