import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { supabase } from "./supabase.js";
import { claimDeliveryBatch, finishDelivery, sendDelivery } from "./delivery-service.js";

export function retryDelayMs(attempt) {
  return Math.min(15 * 60 * 1000, 30 * 1000 * (2 ** Math.max(0, Number(attempt) || 0)));
}

export async function processDelivery({ db, config: workerConfig, fetchImpl = fetch, delivery, now = new Date() }) {
  if (delivery.status === "sent") return { status: "sent", messageId: delivery.provider_message_id || "" };
  try {
    const result = await sendDelivery({ db, fetchImpl, config: workerConfig, delivery });
    await finishDelivery({ db, deliveryId: delivery.id, status: "sent", messageId: result.messageId });
    return { status: "sent", messageId: result.messageId };
  } catch (error) {
    const attempt = Number(delivery.attempt_count || 0);
    const maxAttempts = Number(workerConfig.deliveryMaxAttempts || 8);
    const terminal = attempt >= maxAttempts;
    const nextAttemptAt = terminal ? null : new Date(now.getTime() + retryDelayMs(attempt)).toISOString();
    await finishDelivery({
      db,
      deliveryId: delivery.id,
      status: terminal ? "failed" : "pending",
      error: error instanceof Error ? error.message : String(error),
      nextAttemptAt,
    });
    return { status: terminal ? "failed" : "pending", error };
  }
}

function sleep(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export async function runDeliveryWorker({ db, config: workerConfig, fetchImpl = fetch, signal }) {
  while (!signal?.aborted) {
    let deliveries;
    try {
      deliveries = await claimDeliveryBatch({ db, workerId: workerConfig.workerId, limit: workerConfig.deliveryBatchSize });
    } catch (error) {
      console.error("Unable to claim deliveries", error);
      await sleep(workerConfig.deliveryPollMs, signal);
      continue;
    }
    if (!deliveries.length) {
      await sleep(workerConfig.deliveryPollMs, signal);
      continue;
    }
    for (const delivery of deliveries) {
      if (signal?.aborted) break;
      await processDelivery({ db, config: workerConfig, fetchImpl, delivery });
    }
  }
}

async function main() {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await runDeliveryWorker({ db: supabase, config, signal: controller.signal });
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath && entryPath === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
