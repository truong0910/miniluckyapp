import { mapReward, publicError } from "./utils.js";

const REWARD_COLUMNS = "id,code_prefix,title,value,description,wheel_label,symbol,active,hidden,applicable_products,discount_rate";

export async function listRewards({ db, includeHidden = false }) {
  let query = db.from("reward_catalog").select(REWARD_COLUMNS).order("value", { ascending: false });
  if (!includeHidden) query = query.eq("hidden", false);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapReward);
}

export async function setRewardHidden({ db, id, hidden }) {
  if (typeof hidden !== "boolean") throw publicError("Trạng thái ẩn không hợp lệ");

  const { data, error } = await db
    .from("reward_catalog")
    .update({ hidden })
    .eq("id", id)
    .select(REWARD_COLUMNS)
    .single();
  if (error) throw error;
  if (!data) throw publicError("Không tìm thấy giải thưởng", 404);
  return mapReward(data);
}
