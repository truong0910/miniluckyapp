import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

async function read(relativePath) {
  return fs.readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("backend keeps Zalo and phone session endpoints enabled together", async () => {
  const routes = await read("src/routes/public.routes.js");
  const config = await read("src/config.js");
  assert.match(routes, /\/participant\/sessions\/phone/);
  assert.match(routes, /\/participant\/sessions\/zalo/);
  assert.match(config, /ZALO_APP_SECRET/);
});

test("winner delivery remains backend-owned through ZBS outbox and worker", async () => {
  const routes = await read("src/routes/public.routes.js");
  const worker = await read("src/delivery-worker.js");
  const delivery = await read("src/delivery-service.js");
  const pkg = JSON.parse(await read("package.json"));
  assert.match(routes, /\/delivery\/zbs/);
  assert.match(routes, /\/delivery\/zbs\/templates/);
  assert.match(worker, /runDeliveryWorker/);
  assert.match(delivery, /ZBS_API_KEY|zbsApiKey/);
  assert.match(pkg.scripts["worker:delivery"], /delivery-worker\.js/);
});
