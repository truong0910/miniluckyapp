import appConfig from "../../app-config.json";

export function configureRuntime() {
  if (!window.APP_CONFIG) window.APP_CONFIG = appConfig as any;
}
