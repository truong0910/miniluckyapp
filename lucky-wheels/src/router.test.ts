import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("separate web and Zalo Mini App targets", () => {
  it("routes the browser build through React Router", () => {
    const router = read("./router.web.tsx");
    expect(router).toMatch(/BrowserRouter/);
    expect(router).toMatch(/<Routes>/);
    expect(router).not.toMatch(/zmp-ui|ZMPRouter|AnimationRoutes/);
  });

  it("keeps the ZMP router and plugin in the Mini App target", () => {
    const router = read("./router.miniapp.tsx");
    const config = read("../vite.config.mts");
    expect(router).toMatch(/ZMPRouter/);
    expect(router).toMatch(/AnimationRoutes/);
    expect(config).toMatch(/mode\s*===\s*["']miniapp["']/);
    expect(config).toMatch(/zaloMiniApp\(\)/);
    expect(config).toMatch(/router\.\$\{isMiniApp \? "miniapp" : "web"\}\.tsx/);
  });

  it("resolves shared ZMP UI imports to native web UI in web builds", () => {
    const config = read("../vite.config.mts");
    expect(config).toMatch(/"zmp-ui": path\.resolve\(__dirname, "\.\/src\/platform\/ui\.web\.tsx"\)/);
    expect(config).toMatch(/router\.\$\{isMiniApp \? "miniapp" : "web"\}\.tsx/);
    expect(config).toMatch(/register-form\.\$\{isMiniApp \? "miniapp" : "web"\}\.tsx/);
    expect(config).toMatch(/participant-auth\.\$\{isMiniApp \? "miniapp" : "web"\}\.ts/);
  });
});
