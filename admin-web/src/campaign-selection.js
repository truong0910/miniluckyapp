export function getDefaultCampaignId(campaigns = []) {
  const activeCampaign = campaigns.find((campaign) => campaign?.status === "active");
  return activeCampaign?.id || campaigns[0]?.id || "";
}
