import { publicError } from "./utils.js";

function mapSpinError(error) {
  if (error?.code === "P0001") return publicError("No spins remaining", 409);
  if (error?.code === "P0002") return publicError("Participant is not available", 404);
  if (error?.code === "22023") return publicError("Invalid spin request", 400);
  return error;
}

export async function spinOnce({ db, participant, idempotencyKey, oaFollowed = false, source = "participant" }) {
  const customerId = String(participant?.customerId || "").trim();
  const key = String(idempotencyKey || "").trim();
  if (!customerId) throw publicError("Participant session is required", 401);
  if (!key || key.length > 200) throw publicError("A valid Idempotency-Key header is required", 400);

  const { data, error } = await db.rpc("spin_once", {
    p_customer_id: customerId,
    p_idempotency_key: key,
    p_oa_followed: Boolean(oaFollowed),
    p_source: source,
  });
  if (error) throw mapSpinError(error);
  if (!data || typeof data !== "object") throw publicError("Spin service returned an invalid response", 502);
  return data;
}
