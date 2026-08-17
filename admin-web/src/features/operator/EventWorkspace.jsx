import { useState, useEffect } from "react";
import { fetchCampaignReadiness } from "./operator-api.js";

const STATUS_LABELS = {
  draft: { label: "Nháp (Draft)", badgeClass: "badge-draft" },
  active: { label: "Đang chạy (Active)", badgeClass: "badge-active" },
  paused: { label: "Tạm dừng (Paused)", badgeClass: "badge-paused" },
  ended: { label: "Đã kết thúc (Ended)", badgeClass: "badge-ended" },
  archived: { label: "Đã lưu trữ (Archived)", badgeClass: "badge-archived" },
};

export default function EventWorkspace({
  campaigns = [],
  selectedCampaignId,
  onSelectCampaign,
  mode,
  onToggleMode,
  onNavigateStep,
  onTransitionStatus,
  onCloneCampaign,
}) {
  const [readiness, setReadiness] = useState(null);
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;

  useEffect(() => {
    if (!selectedCampaignId) return;
    fetchCampaignReadiness(selectedCampaignId)
      .then(setReadiness)
      .catch(() => setReadiness(null));
  }, [selectedCampaignId, selectedCampaign?.status]);

  const statusInfo = STATUS_LABELS[selectedCampaign?.status || "draft"] || STATUS_LABELS.draft;

  return (
    <header className="workspace-bar">
      <div className="workspace-left">
        <div className="campaign-selector-wrapper">
          <label htmlFor="workspace-campaign-select" className="eyebrow-label">
            Sự kiện đang làm việc:
          </label>
          <select
            id="workspace-campaign-select"
            className="workspace-select"
            value={selectedCampaignId || ""}
            onChange={(e) => onSelectCampaign(e.target.value)}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code}) — {c.status.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {selectedCampaign && (
          <div className="campaign-status-pill">
            <span className={`status-badge ${statusInfo.badgeClass}`}>{statusInfo.label}</span>
            {readiness && (
              <span
                className={`readiness-pill ${readiness.canActivate ? "ready" : "not-ready"}`}
                onClick={() => onNavigateStep("readiness")}
                title="Bấm để xem checklist kiểm tra sự kiện"
              >
                {readiness.readinessScore}% Sẵn sàng
              </span>
            )}
          </div>
        )}
      </div>

      <div className="workspace-right">
        {selectedCampaign && (
          <div className="workspace-actions">
            {selectedCampaign.status === "draft" || selectedCampaign.status === "paused" ? (
              <button
                className="btn-action primary"
                onClick={() => onNavigateStep("readiness")}
                title="Chuyển đến màn hình Kiểm tra & Kích hoạt"
              >
                🚀 Kích hoạt sự kiện
              </button>
            ) : selectedCampaign.status === "active" ? (
              <>
                <button
                  className="btn-action warning"
                  onClick={() => onTransitionStatus(selectedCampaign.id, "paused")}
                >
                  ⏸️ Tạm dừng
                </button>

                <button
                  className="btn-action danger"
                  onClick={() => onTransitionStatus(selectedCampaign.id, "ended")}
                >
                  🏁 Kết thúc
                </button>
              </>
            ) : null}

            <button
              className="btn-action secondary"
              onClick={() => onCloneCampaign(selectedCampaign)}
            >
              📋 Nhân bản
            </button>
          </div>
        )}

        {/* View Mode Toggle Button */}
        <div className="view-mode-toggle">
          <button
            className={`toggle-btn ${mode === "operator" ? "active" : ""}`}
            onClick={() => onToggleMode("operator")}
            title="Chế độ Vận hành: Quy trình 6 bước đơn giản cho người chạy sự kiện"
          >
            ⚡ Vận hành
          </button>
          <button
            className={`toggle-btn ${mode === "advanced" ? "active" : ""}`}
            onClick={() => onToggleMode("advanced")}
            title="Chế độ Nâng cao: Bảng kỹ thuật chi tiết"
          >
            🛠️ Nâng cao
          </button>
        </div>
      </div>
    </header>
  );
}
