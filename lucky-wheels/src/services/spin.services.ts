import { apiRequest } from "./api.client";
import type { LocalSpinResult } from "./campaign.types";

export type SpinResponse = LocalSpinResult & {
  timestamp?: string;
};

const LAST_SPIN_KEY = "lucky-wheels:last-spin";
const SPIN_HISTORY_KEY = "lucky-wheels:spin-history";
let pendingIdempotencyKey: string | null = null;

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const spinService = {
  async spin(): Promise<SpinResponse> {
    const idempotencyKey = pendingIdempotencyKey || (pendingIdempotencyKey = createIdempotencyKey());
    const result = await apiRequest<SpinResponse>("/spins", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    });
    pendingIdempotencyKey = null;
    const normalized: SpinResponse = {
      ...result,
      timestamp: result.timestamp || new Date().toISOString(),
    };

    // Only keep short-lived UI state for the current Mini App session.
    window.sessionStorage.setItem(LAST_SPIN_KEY, JSON.stringify(normalized));

    const history = this.getSpinHistory();
    history.unshift(normalized);
    window.sessionStorage.setItem(SPIN_HISTORY_KEY, JSON.stringify(history));
    return normalized;
  },

  getLastSpin(): SpinResponse | null {
    const stored = window.sessionStorage.getItem(LAST_SPIN_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as SpinResponse;
    } catch {
      window.sessionStorage.removeItem(LAST_SPIN_KEY);
      return null;
    }
  },

  getSpinHistory(): SpinResponse[] {
    const stored = window.sessionStorage.getItem(SPIN_HISTORY_KEY);
    if (!stored) return [];

    try {
      return JSON.parse(stored) as SpinResponse[];
    } catch {
      return [];
    }
  },

  async fetchSpinHistory(): Promise<SpinResponse[]> {
    try {
      const res = await apiRequest<{ items: any[] }>("/participant/me/spins");
      if (Array.isArray(res.items)) {
        const mapped: SpinResponse[] = res.items.map((item) => ({
          spinId: item.id,
          outcome: item.outcome === "reward" ? "reward" : "better_luck",
          wheelSegmentId: item.reward_code ? `reward-${item.reward_id}` : "better-luck",
          result: item.metadata?.result || ["star", "star", "star"],
          reward: item.reward_code
            ? {
                code: item.reward_code,
                title: item.metadata?.rewardTitle || item.reward_code,
                value: 0,
                description: "",
                wheelLabel: item.metadata?.wheelLabel || "",
              }
            : null,
          timestamp: item.created_at,
          spinsRemaining: Number(item.spins_remaining ?? item.spinsRemaining ?? 0),
        }));
        window.sessionStorage.setItem(SPIN_HISTORY_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch {
      // Fallback to local sessionStorage history if offline/error
    }
    return this.getSpinHistory();
  },

  clearSpinHistory() {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(LAST_SPIN_KEY);
      sessionStorage.removeItem(SPIN_HISTORY_KEY);
    }
  },
};
