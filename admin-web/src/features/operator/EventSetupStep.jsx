import { useState } from "react";
import { api } from "../../api.js";
import UiAlert from "../../components/common/UiAlert.jsx";
import UiButton from "../../components/common/UiButton.jsx";

const EMPTY_CAMPAIGN = { code: "", name: "", startsAt: "", endsAt: "", timezone: "Asia/Ho_Chi_Minh" };

export default function EventSetupStep({ campaign, campaigns = [], onSelectCampaign, onCampaignSaved, onNextStep }) {
  const [form, setForm] = useState(campaign || EMPTY_CAMPAIGN);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [cloneMode, setCloneMode] = useState("config_only");
  const [sourceCampaignId, setSourceCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSaving(true);

    try {
      if (isCreatingNew) {
        if (sourceCampaignId) {
          // Clone flow
          const result = await api(`/admin/campaigns/${sourceCampaignId}/clone`, {
            method: "POST",
            body: JSON.stringify({
              code: form.code,
              name: form.name,
              startsAt: form.startsAt || null,
              endsAt: form.endsAt || null,
              timezone: form.timezone || "Asia/Ho_Chi_Minh",
              allowUnlisted: Boolean(form.allowUnlisted),
              unlistedSpinQuota: Number(form.unlistedSpinQuota ?? 1),
              cloneMode,
            }),
          });
          setSuccessMsg(`Đã nhân bản sự kiện thành công! (Mã: ${result.code})`);
          onCampaignSaved(result);
        } else {
          // Create new flow
          const result = await api("/admin/campaigns", {
            method: "POST",
            body: JSON.stringify({
              code: form.code,
              name: form.name,
              startsAt: form.startsAt || null,
              endsAt: form.endsAt || null,
              timezone: form.timezone || "Asia/Ho_Chi_Minh",
              allowUnlisted: Boolean(form.allowUnlisted),
              unlistedSpinQuota: Number(form.unlistedSpinQuota ?? 1),
            }),
          });
          setSuccessMsg(`Đã tạo sự kiện mới thành công! (Mã: ${result.code})`);
          onCampaignSaved(result);
        }
      } else {
        // Update existing campaign
        const result = await api(`/admin/campaigns/${campaign.id}`, {
          method: "PUT",
          body: JSON.stringify({
            code: form.code,
            name: form.name,
            startsAt: form.startsAt || null,
            endsAt: form.endsAt || null,
            timezone: form.timezone || "Asia/Ho_Chi_Minh",
            allowUnlisted: Boolean(form.allowUnlisted),
            unlistedSpinQuota: Number(form.unlistedSpinQuota ?? 1),
          }),
        });
        setSuccessMsg("Đã cập nhật thông tin sự kiện!");
        onCampaignSaved(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="operator-step-container">
      <div className="step-header-banner">
        <div>
          <h2>Thiết lập Sự kiện</h2>
          <p>Tạo mới sự kiện, thiết lập thời gian diễn ra hoặc nhân bản cấu hình từ sự kiện cũ.</p>
        </div>
      </div>

      {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}
      {successMsg && <UiAlert type="success" onClose={() => setSuccessMsg("")}>{successMsg}</UiAlert>}

      <div className="setup-mode-switcher">
        <button
          type="button"
          className={`mode-tab ${!isCreatingNew ? "active" : ""}`}
          onClick={() => {
            setIsCreatingNew(false);
            if (campaign) setForm(campaign);
          }}
        >
          Chỉnh sửa sự kiện hiện tại
        </button>

        <button
          type="button"
          className={`mode-tab ${isCreatingNew && !sourceCampaignId ? "active" : ""}`}
          onClick={() => {
            setIsCreatingNew(true);
            setSourceCampaignId("");
            setForm(EMPTY_CAMPAIGN);
          }}
        >
          Tạo mới hoàn toàn
        </button>

        <button
          type="button"
          className={`mode-tab ${isCreatingNew && sourceCampaignId ? "active" : ""}`}
          onClick={() => {
            setIsCreatingNew(true);
            setSourceCampaignId(campaigns[0]?.id || "");
            setForm({ ...EMPTY_CAMPAIGN, name: `Nhân bản từ ${campaigns[0]?.name || ""}` });
          }}
        >
          Dùng lại sự kiện cũ (Nhân bản)
        </button>
      </div>

      <form onSubmit={handleSave} className="operator-form-card">
        {isCreatingNew && sourceCampaignId && (
          <div className="form-group highlight-box">
            <label className="form-label">Chọn sự kiện nguồn để nhân bản:</label>
            <select
              className="form-control"
              value={sourceCampaignId}
              onChange={(e) => setSourceCampaignId(e.target.value)}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>

            <div className="clone-mode-options">
              <label className="radio-label">
                <input
                  type="radio"
                  name="cloneMode"
                  value="config_only"
                  checked={cloneMode === "config_only"}
                  onChange={() => setCloneMode("config_only")}
                />
                <span>Chỉ nhân bản cấu hình (Danh mục giải thưởng + Luật quay)</span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="cloneMode"
                  value="config_and_participants"
                  checked={cloneMode === "config_and_participants"}
                  onChange={() => setCloneMode("config_and_participants")}
                />
                <span>Nhân bản cả cấu hình VÀ danh sách khách tham gia</span>
              </label>
            </div>
          </div>
        )}

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Mã sự kiện (Unique Code) *</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: BIGG_SUMMER_2026"
              value={form.code || ""}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
              disabled={!isCreatingNew && campaign?.status !== "draft"}
            />
            <small className="form-help">Chỉ gồm chữ in hoa, số và gạch ngang (2-50 ký tự).</small>
          </div>

          <div className="form-group">
            <label className="form-label">Tên sự kiện hiển thị *</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Chương trình Vòng quay may mắn Mùa Hè"
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Thời gian bắt đầu (Không bắt buộc)</label>
            <input
              type="datetime-local"
              className="form-control"
              value={form.startsAt ? new Date(form.startsAt).toISOString().slice(0, 16) : ""}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Thời gian kết thúc (Không bắt buộc)</label>
            <input
              type="datetime-local"
              className="form-control"
              value={form.endsAt ? new Date(form.endsAt).toISOString().slice(0, 16) : ""}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </div>
        </div>

        {/* UNLISTED CUSTOMER ACCESS POLICY SECTION */}
        <div className="operator-card-section highlight-box" style={{ marginTop: "16px", marginBottom: "16px" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", color: "#1e293b" }}>Chính sách Khách ngoài danh sách (Zalo Auto-Enroll)</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label className="radio-label" style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={Boolean(form.allowUnlisted)}
                onChange={(e) => setForm({ ...form, allowUnlisted: e.target.checked })}
                style={{ width: "18px", height: "18px" }}
              />
              <div>
                <strong>Cho phép khách chưa có trong danh sách tự đăng ký tham gia</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                  Khi bật, khách mới truy cập Mini App xác minh số Zalo sẽ tự động được cấp quyền tham gia sự kiện.
                </p>
              </div>
            </label>

            {form.allowUnlisted && (
              <div className="form-group" style={{ marginTop: "8px", maxWidth: "280px" }}>
                <label className="form-label">Số lượt quay mặc định cho khách tự đăng ký *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-control"
                  value={form.unlistedSpinQuota ?? 1}
                  onChange={(e) => setForm({ ...form, unlistedSpinQuota: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  required
                />
                <small className="form-help">Mặc định 1 lượt (Admin có thể chỉnh sửa riêng từng khách sau).</small>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <UiButton type="submit" variant="primary" loading={saving}>
            {isCreatingNew ? "Tạo sự kiện" : "Lưu thay đổi"}
          </UiButton>
          <UiButton type="button" variant="secondary" onClick={() => onNextStep("participants")}>
            Tiếp tục: Thêm khách tham gia -&gt;
          </UiButton>
        </div>
      </form>
    </div>
  );
}
