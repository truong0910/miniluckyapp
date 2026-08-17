import { api } from "../../api.js";

export async function fetchCampaignReadiness(campaignId) {
  if (!campaignId) return null;
  return api(`/admin/campaigns/${campaignId}/readiness`);
}

export async function executeDryRunSpin(campaignId, phone = "0900000000", spinNumber = 1) {
  if (!campaignId) throw new Error("Chưa chọn sự kiện để quay thử");
  return api(`/admin/campaigns/${campaignId}/dry-run-spin`, {
    method: "POST",
    body: JSON.stringify({ phone, spinNumber }),
  });
}

export async function fetchCampaignSummary(campaignId) {
  if (!campaignId) return null;
  return api(`/admin/campaigns/${campaignId}/analytics`);
}

export async function fetchCampaignParticipants(campaignId, page = 1, limit = 20, search = "") {
  if (!campaignId) return { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
  const params = new URLSearchParams({ page: String(page), limit: String(limit), search: String(search || "").trim() });
  return api(`/admin/campaigns/${campaignId}/participants?${params}`);
}
