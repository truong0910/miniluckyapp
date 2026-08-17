import { useEffect, useState } from "react";
import { api } from "../../api.js";
import UiAlert from "../../components/common/UiAlert.jsx";
import UiButton from "../../components/common/UiButton.jsx";

export default function ParticipantEditModal({ isOpen, campaignId, customerId, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState("quota");
  const [detail, setDetail] = useState(null);
  const [rewardsList, setRewardsList] = useState([]);
  const [catalog, setCatalog] = useState([]);
  
  // Quota / Status State
  const [spinQuota, setSpinQuota] = useState(1);
  const [status, setStatus] = useState("active");
  const [savingQuota, setSavingQuota] = useState(false);

  // Manual Award State
  const [selectedRewardId, setSelectedRewardId] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [issuingAward, setIssuingAward] = useState(false);

  // Alert Messages
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = async () => {
    if (!campaignId || !customerId || !isOpen) return;
    setError("");
    try {
      const [dRes, rRes, cRes] = await Promise.all([
        api(`/admin/campaigns/${campaignId}/participants/${customerId}`),
        api(`/admin/campaigns/${campaignId}/participants/${customerId}/rewards`),
        api("/admin/rewards"),
      ]);
      setDetail(dRes);
      setSpinQuota(dRes.spinQuota || 1);
      setStatus(dRes.status || "active");
      setRewardsList(rRes.items || []);
      setCatalog(cRes.items || []);
      if (cRes.items?.[0]) setSelectedRewardId(cRes.items[0].id);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [isOpen, campaignId, customerId]);

  if (!isOpen) return null;

  const handleSaveQuotaStatus = async (e) => {
    e.preventDefault();
    setSavingQuota(true);
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/campaigns/${campaignId}/participants/${customerId}`, {
        method: "PUT",
        body: JSON.stringify({ status, spinQuota }),
      });
      setSuccessMsg("Đã cập nhật lượt quay và trạng thái thành công!");
      if (onSaved) onSaved();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingQuota(false);
    }
  };

  const handleIssueManualAward = async (e) => {
    e.preventDefault();
    if (!manualReason.trim()) {
      setError("Vui lòng nhập lý do cấp quà bổ sung!");
      return;
    }
    setIssuingAward(true);
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/campaigns/${campaignId}/participants/${customerId}/manual-awards`, {
        method: "POST",
        body: JSON.stringify({
          rewardId: selectedRewardId,
          code: manualCode,
          reason: manualReason,
        }),
      });
      setSuccessMsg("Đã phát thêm Quà bổ sung thành công!");
      setManualCode("");
      setManualReason("");
      if (onSaved) onSaved();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIssuingAward(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: "600px", width: "90%" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Quản lý Khách hàng: {detail?.customerName || customerId}</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}
          {successMsg && <UiAlert type="success" onClose={() => setSuccessMsg("")}>{successMsg}</UiAlert>}

          <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", marginBottom: "16px" }}>
            <button
              type="button"
              className={`mode-tab ${activeTab === "quota" ? "active" : ""}`}
              onClick={() => setActiveTab("quota")}
            >
              Lượt quay &amp; Quyền quay
            </button>
            <button
              type="button"
              className={`mode-tab ${activeTab === "vouchers" ? "active" : ""}`}
              onClick={() => setActiveTab("vouchers")}
            >
              Voucher cấp sẵn ({rewardsList.length})
            </button>
            <button
              type="button"
              className={`mode-tab ${activeTab === "manual" ? "active" : ""}`}
              onClick={() => setActiveTab("manual")}
            >
              Cấp quà bổ sung
            </button>
          </div>

          {activeTab === "quota" && (
            <form onSubmit={handleSaveQuotaStatus}>
              <div className="form-group mb-4">
                <label className="form-label">Tên khách hàng:</label>
                <input type="text" className="form-control" value={detail?.customerName || ""} disabled />
              </div>

              <div className="form-group mb-4">
                <label className="form-label">Số điện thoại:</label>
                <input type="text" className="form-control" value={detail?.customerPhone || "—"} disabled />
              </div>

              <div className="form-grid-2 mb-4">
                <div className="form-group">
                  <label className="form-label">Số lượt quay được cấp *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-control"
                    value={spinQuota}
                    onChange={(e) => setSpinQuota(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    required
                  />
                  <small className="form-help">Đã quay: {detail?.spinsUsed || 0} lượt | Còn lại: {detail?.spinsRemaining || 0} lượt</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Trạng thái quyền quay *</label>
                  <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Cho phép quay (Active)</option>
                    <option value="paused">Tạm khóa quay (Paused)</option>
                  </select>
                </div>
              </div>

              <div className="form-actions mt-4">
                <UiButton type="submit" variant="primary" loading={savingQuota}>Lưu thông tin</UiButton>
                <UiButton type="button" variant="secondary" onClick={onClose}>Hủy bỏ</UiButton>
              </div>
            </form>
          )}

          {activeTab === "vouchers" && (
            <div>
              {detail?.spinsUsed > 0 && (
                <UiAlert type="warning" title="Khách đã quay trong sự kiện">
                  Khách hàng đã thực hiện {detail.spinsUsed} lượt quay. Theo chính sách an toàn, không thể sửa voucher cấp sẵn sau khi quay. Vui lòng dùng tab "Cấp quà bổ sung" nếu cần trao thêm quà.
                </UiAlert>
              )}

              <div className="table-responsive mt-3">
                <table className="operator-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Mã Voucher</th>
                      <th>Mệnh giá</th>
                      <th>Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewardsList.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center", padding: "16px", color: "#64748b" }}>
                          Khách hàng này chưa có Voucher cấp sẵn nào trong sự kiện.
                        </td>
                      </tr>
                    ) : (
                      rewardsList.map((r, idx) => (
                        <tr key={r.id || idx}>
                          <td>{idx + 1}</td>
                          <td><code>{r.code}</code></td>
                          <td><strong>{Number(r.value || 0).toLocaleString("vi-VN")}đ</strong></td>
                          <td><small>{r.title || r.description}</small></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "manual" && (
            <form onSubmit={handleIssueManualAward}>
              <UiAlert type="info">
                Cấp quà bổ sung trực tiếp cho khách hàng. Hành động này tạo bản ghi Award lịch sử và ghi lại nhật ký quản trị (Audit log).
              </UiAlert>

              <div className="form-group mb-3 mt-3">
                <label className="form-label">Chọn Giải thưởng cấp thêm *</label>
                <select
                  className="form-control"
                  value={selectedRewardId}
                  onChange={(e) => setSelectedRewardId(e.target.value)}
                  required
                >
                  {catalog.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.value ? Number(r.value).toLocaleString("vi-VN") + "đ" : ""})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Mã quà (Để trống để tự tạo mã):</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: VIP-GIFT-99"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Lý do cấp quà bổ sung (Bắt buộc) *</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="VD: Cấp quà đền bù cho sự kiện hội thảo 17/08"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  required
                />
              </div>

              <div className="form-actions mt-4">
                <UiButton type="submit" variant="primary" loading={issuingAward}>Xác nhận Cấp quà</UiButton>
                <UiButton type="button" variant="secondary" onClick={onClose}>Đóng</UiButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
