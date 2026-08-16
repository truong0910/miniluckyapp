import { getCampaign } from "./campaign-service.js";

export function calculateCampaignMetrics({ participants = [], spinEvents = [], awards = [] }) {
  const totalParticipants = participants.length;
  const totalAllocatedSpins = participants.reduce((sum, p) => sum + (Number(p.spin_quota) || 0), 0);
  const totalSpinsUsed = spinEvents.length;
  const totalWinningSpins = spinEvents.filter((s) => s.outcome === "reward").length;

  let awardsIssued = 0;
  let awardsDelivering = 0;
  let awardsDelivered = 0;
  let awardsRedeemed = 0;
  let awardsExpired = 0;
  let awardsVoided = 0;

  for (const a of awards) {
    if (a.status === "issued") awardsIssued++;
    else if (a.status === "delivering") awardsDelivering++;
    else if (a.status === "delivered") awardsDelivered++;
    else if (a.status === "redeemed") awardsRedeemed++;
    else if (a.status === "expired") awardsExpired++;
    else if (a.status === "void") awardsVoided++;
  }

  return {
    totalParticipants,
    totalAllocatedSpins,
    totalSpinsUsed,
    remainingSpins: Math.max(0, totalAllocatedSpins - totalSpinsUsed),
    totalWinningSpins,
    awardsTotal: awards.length,
    awardsIssued,
    awardsDelivering,
    awardsDelivered,
    awardsRedeemed,
    awardsExpired,
    awardsVoided,
  };
}

export function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function formatAwardsToCsv(awards = []) {
  const headers = ["Mã Voucher", "Tên Khách hàng", "SĐT", "Phần thưởng", "Giá trị", "Trạng thái", "Ngày cấp"];
  const rows = [headers.map(escapeCsvCell).join(",")];

  for (const a of awards) {
    const row = [
      a.code || "",
      a.customerName || a.customer_name || "",
      a.customerPhone || a.customer_phone || "",
      a.title || "",
      a.value || 0,
      a.status || "",
      a.issuedAt || a.issued_at || "",
    ];
    rows.push(row.map(escapeCsvCell).join(","));
  }

  return rows.join("\r\n");
}

export async function getCampaignAnalytics({ db, campaignId }) {
  const campaign = await getCampaign({ db, id: campaignId });

  const [{ data: participants }, { data: spinEvents }, { data: awards }] = await Promise.all([
    db.from("campaign_participants").select("spin_quota").eq("campaign_id", campaignId),
    db.from("spin_events").select("outcome").eq("campaign_id", campaignId),
    db.from("awards").select("status").eq("campaign_id", campaignId),
  ]);

  const metrics = calculateCampaignMetrics({
    participants: participants || [],
    spinEvents: spinEvents || [],
    awards: awards || [],
  });

  return {
    campaign: { id: campaign.id, code: campaign.code, name: campaign.name, status: campaign.status },
    metrics,
  };
}

export async function generateCampaignExportCsv({ db, campaignId }) {
  const { data: rows } = await db
    .from("awards")
    .select("code,title_snapshot,value_snapshot,status,issued_at,customers(name,phone)")
    .eq("campaign_id", campaignId)
    .order("issued_at", { ascending: false });

  const mapped = (rows || []).map((r) => ({
    code: r.code,
    title: r.title_snapshot,
    value: r.value_snapshot,
    status: r.status,
    issuedAt: r.issued_at,
    customerName: r.customers?.name || "",
    customerPhone: r.customers?.phone || "",
  }));

  return formatAwardsToCsv(mapped);
}
