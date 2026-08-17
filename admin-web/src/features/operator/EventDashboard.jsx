import { useEffect, useState } from "react";
import { fetchCampaignSummary } from "./operator-api.js";
import { downloadFile } from "../../api.js";

export default function EventDashboard({ campaign, onNavigateStep }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!campaign?.id) return;
    setLoading(true);
    setError("");
    fetchCampaignSummary(campaign.id)
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [campaign?.id]);

  const exportCsv = async () => {
    if (!campaign?.id) return;
    try {
      await downloadFile(`/admin/campaigns/${campaign.id}/export`, `campaign-${campaign.id}-export.csv`);
    } catch (e) {
      setError(e.message);
    }
  };

  const m = summary?.metrics || {};

  return (
    <div className="operator-step-container">
      <div className="step-header-banner">
        <div>
          <h2>Báo cáo & Tổng quan Sự kiện: {campaign?.name}</h2>
          <p>Theo dõi thời gian thực kết quả lượt quay, voucher đã trao và đồng bộ báo cáo.</p>
        </div>
        <div className="banner-actions">
          <button className="btn-primary" onClick={exportCsv}>
            Xuất Báo cáo CSV
          </button>
          <button className="btn-secondary" onClick={() => onNavigateStep("participants")}>
            Quản lý Khách
          </button>
        </div>
      </div>

      {error && <div className="error-card">{error}</div>}

      {loading ? (
        <div className="loading-state">Đang tải số liệu tổng quan...</div>
      ) : (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Thành viên sự kiện</span>
                <strong className="metric-value">{m.totalParticipants ?? 0}</strong>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Lượt quay đã cấp</span>
                <strong className="metric-value">{m.totalAllocatedSpins ?? 0}</strong>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Lượt đã sử dụng</span>
                <strong className="metric-value">{m.totalSpinsUsed ?? 0}</strong>
              </div>
            </div>

            <div className="metric-card highlight">
              <div className="metric-content">
                <span className="metric-label">Voucher trúng quà</span>
                <strong className="metric-value">{m.awardsTotal ?? 0}</strong>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Voucher đã đổi</span>
                <strong className="metric-value">{m.awardsRedeemed ?? 0}</strong>
              </div>
            </div>
          </div>

          <div className="operator-card-section">
            <h3>Trạng thái Báo cáo Realtime</h3>
            <p>
              Mỗi lượt quay trúng quà được tự động ghi nhận trực tiếp theo mã sự kiện <code>{campaign?.code}</code> và bảo lưu lịch sử thống kê thương hiệu Hồng Phúc Glass.
            </p>
            <div className="sheets-sync-status">
              <span className="dot-active"></span>
              <strong>Hệ thống Báo cáo Realtime: Đang hoạt động</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
