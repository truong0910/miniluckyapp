import { supabase } from "./supabase.js";
import { config } from "./config.js";
import { verifyDevelopmentAdminToken } from "./auth/admin-session.js";
import { findParticipantSession } from "./participant-auth.js";
import { asyncRoute, publicError } from "./utils.js";

export const requireAdmin = asyncRoute(async (req, _res, next) => {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw publicError("Thiếu token quản trị", 401);

  if (config.appEnv === "development" && config.adminAuthMode === "development") {
    try {
      const payload = verifyDevelopmentAdminToken(token, config.devAuthSecret);
      req.admin = { user: { id: payload.id, email: payload.email }, profile: { role: payload.role } };
      next();
      return;
    } catch {
      throw publicError("Phiên quản trị phát triển không hợp lệ", 401);
    }
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw publicError("Phiên quản trị không hợp lệ", 401);

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("user_id,role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (profileError || !profile) throw publicError("Tài khoản không có quyền quản trị", 403);

  req.admin = { user: data.user, profile };
  next();
});

export const requireParticipant = asyncRoute(async (req, _res, next) => {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw publicError("Thiếu participant token", 401);
  const session = await findParticipantSession({ db: supabase, token });
  if (!session) throw publicError("Participant session không hợp lệ hoặc đã hết hạn", 401);
  req.participant = session;
  next();
});
