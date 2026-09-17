import AppRouter from "@/platform/router";
import AppShell from "@/platform/app-shell";
import { syncRemoteContent } from "@/services/content.services";
import { useEffect } from "react";

export default function MiniApp() {
  useEffect(() => {
    void syncRemoteContent();
  }, []);

  return (
    <AppShell>
      <AppRouter />
    </AppShell>
  );
}
