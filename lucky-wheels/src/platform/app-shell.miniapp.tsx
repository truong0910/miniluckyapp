import "zmp-ui/zaui.css";
import { App, SnackbarProvider } from "zmp-ui";
import type { PropsWithChildren } from "react";

export default function MiniAppShell({ children }: PropsWithChildren) {
  return <App><SnackbarProvider>{children}</SnackbarProvider></App>;
}
