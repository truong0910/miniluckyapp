import { publicError } from "./utils.js";

async function requireAdminProfile(adminDb, userId) {
  const { data, error } = await adminDb
    .from("admin_profiles")
    .select("user_id,role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw publicError("Tài khoản chưa được cấp quyền Admin", 403);
  return data;
}

export async function changeAdminPassword({ authClient, adminDb, email, currentPassword, newPassword, confirmPassword }) {
  const normalizedEmail = String(email || "").trim();
  const current = String(currentPassword || "");
  const next = String(newPassword || "");
  const confirmation = String(confirmPassword || "");
  if (!normalizedEmail || !current || !next || !confirmation) throw publicError("Vui lòng nhập đầy đủ thông tin đổi mật khẩu");
  if (next.length < 8) throw publicError("Mật khẩu mới phải có ít nhất 8 ký tự");
  if (next !== confirmation) throw publicError("Mật khẩu xác nhận không khớp");

  const { data, error } = await authClient.auth.signInWithPassword({ email: normalizedEmail, password: current });
  if (error || !data?.user?.id) throw publicError("Email hoặc mật khẩu hiện tại không đúng", 401);
  await requireAdminProfile(adminDb, data.user.id);

  const { error: updateError } = await adminDb.auth.admin.updateUserById(data.user.id, { password: next });
  if (updateError) throw publicError("Không thể đổi mật khẩu lúc này. Vui lòng thử lại.", 502);
  return { email: data.user.email || normalizedEmail };
}

export async function refreshSupabaseAdminSession({ authClient, adminDb, refreshToken }) {
  const token = String(refreshToken || "");
  if (!token) throw publicError("Thiếu refresh token", 401);

  const { data, error } = await authClient.auth.refreshSession({ refresh_token: token });
  if (error || !data?.session || !data?.user?.id) throw publicError("Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.", 401);
  await requireAdminProfile(adminDb, data.user.id);

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email },
  };
}
