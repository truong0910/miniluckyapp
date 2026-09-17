import { publicError } from "./utils.js";

const AWARD_COLUMNS =
  "id,campaign_id,spin_event_id,reward_id,code,title_snapshot,value_snapshot,description_snapshot,result,status,issued_at,delivered_at,redeemed_at,expires_at";

function parseBoundedInteger(value, name, fallback, maximum) {
  if (value === undefined) return fallback;

  const validInteger =
    (typeof value === "number" && Number.isInteger(value)) ||
    (typeof value === "string" && /^\d+$/.test(value));
  if (!validInteger) throw publicError(`Invalid ${name}`);

  const parsed = Number(value);
  if (parsed < 1 || parsed > maximum) throw publicError(`Invalid ${name}`);
  return parsed;
}

export function parseAwardsPagination(query = {}) {
  return {
    page: parseBoundedInteger(query.page, "page", 1, 100),
    limit: parseBoundedInteger(query.limit, "limit", 20, 50),
  };
}

function mapAward(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    spinEventId: row.spin_event_id,
    rewardId: row.reward_id ?? null,
    code: row.code,
    title: row.title_snapshot,
    value: Number(row.value_snapshot),
    description: row.description_snapshot ?? "",
    result: row.result,
    status: row.status,
    issuedAt: row.issued_at ?? null,
    deliveredAt: row.delivered_at ?? null,
    redeemedAt: row.redeemed_at ?? null,
    expiresAt: row.expires_at ?? null,
  };
}

export async function listParticipantAwards({ db, customerId, page, limit }) {
  const start = (page - 1) * limit;
  const { data: rows, error } = await db
    .from("awards")
    .select(AWARD_COLUMNS)
    .eq("customer_id", customerId)
    .order("issued_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + limit);

  if (error) throw error;

  const awards = rows || [];
  return {
    page,
    limit,
    hasMore: awards.length > limit,
    items: awards.slice(0, limit).map(mapAward),
  };
}
