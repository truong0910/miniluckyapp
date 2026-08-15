import type { Participant } from "./participant.services";
import type { SpinResponse } from "./spin.services";
import { apiRequest } from "./api.client";

const DELIVERY_STORAGE_PREFIX = "lucky-wheels:zbs-delivery:";
let backendZbsConfigured: boolean | null = null;
export type ZbsDeliveryStatus = "pending" | "processing" | "sent" | "failed";

export interface ZbsDeliveryRecord {
  spinId: string;
  deliveryId?: string;
  status: ZbsDeliveryStatus;
  updatedAt: string;
  message?: string;
  messageId?: string;
}

export class ZbsDeliveryError extends Error {
  constructor(message: string, public readonly reason: "not_configured" | "request_failed") {
    super(message);
    this.name = "ZbsDeliveryError";
  }
}

const inFlightDeliveries = new Map<string, Promise<ZbsDeliveryRecord>>();

function readDelivery(spinId: string): ZbsDeliveryRecord | null {
  const stored = window.sessionStorage.getItem(`${DELIVERY_STORAGE_PREFIX}${spinId}`);
  if (!stored) return null;
  try { return JSON.parse(stored) as ZbsDeliveryRecord; } catch { window.sessionStorage.removeItem(`${DELIVERY_STORAGE_PREFIX}${spinId}`); return null; }
}

function writeDelivery(record: ZbsDeliveryRecord) {
  window.sessionStorage.setItem(`${DELIVERY_STORAGE_PREFIX}${record.spinId}`, JSON.stringify(record));
}

export const zbsService = {
  // The API key is intentionally not shipped to the Mini App. The backend decides
  // whether ZBS is configured. The default stays enabled until the first content
  // response tells us otherwise, so a slow content request does not create a
  // false "not configured" message.
  isConfigured() { return backendZbsConfigured !== false; },
  setConfigured(value: boolean) { backendZbsConfigured = value; },
  async getTemplates() { return apiRequest<unknown[]>("/delivery/zbs/templates"); },
  getDelivery(spinId: string) { return readDelivery(spinId); },
  async sendWinnerVoucher(spinResult: SpinResponse, participant: Participant): Promise<ZbsDeliveryRecord> {
    if (spinResult.outcome !== "reward" || !spinResult.reward) throw new ZbsDeliveryError("Kết quả quay không có voucher để gửi.", "request_failed");
    const existing = readDelivery(spinResult.spinId);
    if (existing?.status === "sent") return existing;
    const active = inFlightDeliveries.get(spinResult.spinId);
    if (active) return active;
    const promise = (async () => {
      try {
        const result = await apiRequest<ZbsDeliveryRecord>("/delivery/zbs", { method: "POST", body: JSON.stringify({ spinId: spinResult.spinId }) });
        const record = { ...result, updatedAt: result.updatedAt || new Date().toISOString() };
        writeDelivery(record);
        return record;
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        const record: ZbsDeliveryRecord = { spinId: spinResult.spinId, status: "failed", updatedAt: new Date().toISOString(), message: error instanceof Error ? error.message : "Không thể gửi Voucher" };
        writeDelivery(record);
        throw new ZbsDeliveryError(record.message || "Không thể gửi Voucher", status === 503 ? "not_configured" : "request_failed");
      } finally { inFlightDeliveries.delete(spinResult.spinId); }
    })();
    inFlightDeliveries.set(spinResult.spinId, promise);
    return promise;
  },
};
