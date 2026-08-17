import { useEffect, useState } from "react";
import { executeDryRunSpin, fetchCampaignReadiness } from "./operator-api.js";
import UiAlert from "../../components/common/UiAlert.jsx";
import ConfirmModal from "../../components/common/ConfirmModal.jsx";
import UiButton from "../../components/common/UiButton.jsx";

export default function LaunchChecklist({ campaign, onTransitionStatus, onNextStep }) {
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dryRunPhone, setDryRunPhone] = useState("0901234567");
  const [dryRunResult, setDryRunResult] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadChecklist = async () => {
    if (!campaign?.id) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchCampaignReadiness(campaign.id);
      setReadiness(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChecklist();
  }, [campaign?.id, campaign?.status]);

  const handleDryRun = async (e) => {
    e.preventDefault();
    if (!campaign?.id) return;
    setSimulating(true);
    setError("");

    try {
      const res = await executeDryRunSpin(campaign.id, dryRunPhone, 1);
      setDryRunResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSimulating(false);
    }
  };

  const handleActivate = async () => {
    if (!campaign?.id) return;
    setError("");
    setSuccessMsg("");
    setActivating(true);
    try {
      await onTransitionStatus(campaign.id, "active");
      setSuccessMsg(`Đã kích hoạt thành công sự kiện '${campaign.name}'!`);
      setShowActivateModal(false);
      await loadChecklist();
    } catch (err) {
      setError(err.message);
      setShowActivateModal(false);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="operator-step-container">
      <div className="step-header-banner">
        <div>
          <h2>Kiểm tra &amp; Kích hoạt Sự kiện</h2>
          <p>Rà soát danh mục kiểm tra an toàn và quay thử trước khi chính thức mở sự kiện.</p>
        </div>
      </div>

      {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}
      {successMsg && <UiAlert type="success" onClose={() => setSuccessMsg("")}>{successMsg}</UiAlert>}

      <div className="launch-grid">
        {/* Left Column: Readiness Checklist */}
        <div className="operator-card-section">
          <div className="checklist-header">
            <h3>Checklist Kiểm tra An toàn</h3>
            {readiness && (
              <span className={`score-badge ${readiness.canActivate ? "pass" : "fail"}`}>
                {readiness.readinessScore}% Sẵn sàng
              </span>
            )}
          </div>

          {loading ? (
            <div className="loading-state">Đang kiểm tra thông số sự kiện...</div>
          ) : (
            <ul className="checklist-items">
              {readiness?.checks?.map((item) => (
                <li key={item.key} className={`check-item ${item.passed ? "passed" : "failed"}`}>
                  <span className="check-icon">{item.passed ? "[Đạt]" : "[Chưa đạt]"}</span>
                  <div className="check-info">
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="activation-box">
            {campaign?.status === "active" ? (
              <div className="active-banner">
                <span>Sự kiện đang ở trạng thái ACTIVE (Đang chạy).</span>
                <UiButton
                  variant="warning"
                  size="md"
                  onClick={() => onTransitionStatus(campaign.id, "paused")}
                >
                  Tạm dừng sự kiện
                </UiButton>
              </div>
            ) : (
              <UiButton
                variant="primary"
                size="lg"
                className="w-full shine-sweep"
                onClick={() => setShowActivateModal(true)}
                disabled={!readiness?.canActivate}
              >
                KÍCH HOẠT SỰ KIỆN NGAY
              </UiButton>
            )}
          </div>
        </div>

        {/* Right Column: Dry-Run Simulation Sandbox */}
        <div className="operator-card-section dry-run-card">
          <h3>Chế độ Quay thử (Dry-Run Simulation)</h3>
          <p className="text-xs text-slate-300">
            Mô phỏng lượt quay của một số điện thoại bất kỳ. Chế độ này <strong>không ghi dữ liệu</strong>, không trừ
            tồn kho và không gửi ZNS/Google Sheets.
          </p>

          <form onSubmit={handleDryRun} className="dry-run-form mt-4">
            <div className="form-group">
              <label className="form-label">SĐT thử nghiệm:</label>
              <input
                type="text"
                className="form-control"
                value={dryRunPhone}
                onChange={(e) => setDryRunPhone(e.target.value)}
                required
              />
            </div>

            <UiButton type="submit" variant="secondary" size="md" className="w-full" loading={simulating}>
              Quay thử ngay
            </UiButton>
          </form>

          {dryRunResult && (
            <div className="dry-run-result-box mt-4">
              <h4>Kết quả Mô phỏng:</h4>
              <div className="result-field">
                <span>Số điện thoại:</span> <code>{dryRunResult.phone}</code>
              </div>

              <div className="result-field">
                <span>Kết quả mô phỏng:</span>
                <strong className={dryRunResult.simulatedOutcome === "reward" ? "text-green" : "text-amber"}>
                  {dryRunResult.simulatedOutcome === "reward" ? "TRÚNG QUÀ" : "MAY MẮN LẦN SAU"}
                </strong>
              </div>

              {dryRunResult.matchedReward && (
                <div className="result-field">
                  <span>Giải thưởng dự kiến:</span>
                  <strong>{dryRunResult.matchedReward.title}</strong>
                </div>
              )}

              <small className="dry-run-note">Ghi chú: {dryRunResult.note}</small>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRM ACTIVATION MODAL */}
      <ConfirmModal
        isOpen={showActivateModal}
        title="Xác nhận Kích hoạt Sự kiện"
        message={`Bạn có chắc chắn muốn mở và Kích hoạt sự kiện '${campaign?.name || ""}' cho khách hàng tham gia ngay bây giờ không?`}
        confirmText="Mở &amp; Kích hoạt Ngay"
        cancelText="Hủy bỏ"
        variant="primary"
        loading={activating}
        onConfirm={handleActivate}
        onCancel={() => setShowActivateModal(false)}
      />
    </div>
  );
}
