import { apiRequest } from "./api.client";

export interface ParticipantAward {
  id: string;
  campaignId: string | null;
  spinEventId: string | null;
  rewardId: string | null;
  code: string;
  title: string;
  value: number;
  description: string;
  result: string[] | null;
  status: "issued" | "delivered" | "redeemed" | "expired" | string;
  issuedAt: string | null;
  deliveredAt: string | null;
  redeemedAt: string | null;
  expiresAt: string | null;
}

export interface PaginatedAwards {
  items: ParticipantAward[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export const awardService = {
  async getParticipantAwards(page = 1, limit = 20): Promise<PaginatedAwards> {
    return apiRequest<PaginatedAwards>(`/participant/me/awards?page=${page}&limit=${limit}`);
  },
};
