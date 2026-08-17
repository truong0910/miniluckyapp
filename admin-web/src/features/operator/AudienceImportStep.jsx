import { useEffect, useState } from "react";
import { api, downloadFile } from "../../api.js";
import { fetchCampaignParticipants } from "./operator-api.js";
import { parseCsvToRows, parseWorkbookToRows } from "../../import-parser.js";
import UiAlert from "../../components/common/UiAlert.jsx";
import ConfirmModal from "../../components/common/ConfirmModal.jsx";
import UiButton from "../../components/common/UiButton.jsx";
import ParticipantEditModal from "./ParticipantEditModal.jsx";

export default function AudienceImportStep({ campaign, onNextStep }) {
  // Participant List State
  const [participants, setParticipants] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  // Edit Modal State
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Import State
  const [file, setFile] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [importMode, setImportMode] = useState("voucher");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState("");

  const loadParticipants = async (p = page, s = search) => {
    if (!campaign?.id) return;
    setLoadingList(true);
    try {
      const data = await fetchCampaignParticipants(campaign.id, p, 20, s);
      setParticipants(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Lỗi khi tải danh sách khách tham gia", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadParticipants(1, search);
  }, [campaign?.id]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadParticipants(1, search);
  };

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setParsing(true);
    setError("");
    setImportResult(null);

    try {
      let rows = [];
      if (selected.name.endsWith(".csv") || selected.name.endsWith(".txt")) {
        const text = await selected.text();
        rows = parseCsvToRows(text);
      } else if (selected.name.endsWith(".xlsx") || selected.name.endsWith(".xls")) {
        const buffer = await selected.arrayBuffer();
        rows = parseWorkbookToRows(buffer);
      } else {
        throw new Error("Định dạng file không hỗ trợ (chỉ nhận .xlsx, .xls, .csv)");
      }
      setRawRows(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const executeImport = async () => {
    if (!campaign?.id || rawRows.length === 0) return;
    setImporting(true);
    setError("");

    try {
      const result = await api(`/admin/campaigns/${campaign.id}/participants`, {
        method: "POST",
        body: JSON.stringify({
          importMode,
          rows: rawRows,
        }),
      });
      setImportResult(result);
      setShowConfirmModal(false);
      await loadParticipants(1, search);
    } catch (err) {
      setError(err.message);
      setShowConfirmModal(false);
    } finally {
      setImporting(false);
    }
  };

  const previewRows = rawRows.slice(0, 20);

  return (
    <div className="operator-step-container">
      <div className="step-header-banner">
        <div>
          <h2>Danh sách Khách tham gia &amp; Import Excel</h2>
          <p>Quản lý danh sách khách đã ghi nhận và Import dữ liệu từ file Excel cho sự kiện <strong>{campaign?.name}</strong>.</p>
        </div>
      </div>

      {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}

      {/* SECTION 1: ROSTER OF EXISTING PARTICIPANTS */}
      <div className="operator-card-section">
        <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h3>Danh sách Khách đã đăng ký trong sự kiện ({totalCount})</h3>
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo tên hoặc SĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "240px" }}
            />
            <UiButton type="submit" variant="secondary" size="md">Tìm kiếm</UiButton>
          </form>
        </div>

        {loadingList ? (
          <div className="loading-state">Đang tải danh sách khách tham gia...</div>
        ) : participants.length === 0 ? (
          <div className="empty-state">
            Chưa có khách hàng nào tham gia sự kiện này. Bạn có thể Import file Excel bên dưới để cấp quyền.
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="operator-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Tên khách hàng</th>
                    <th>Số điện thoại</th>
                    <th>Số lượt quay</th>
                    <th>Nguồn tham gia</th>
                    <th>Trạng thái</th>
                    <th>Ngày thêm</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, idx) => (
                    <tr key={p.id || idx}>
                      <td>{(page - 1) * 20 + idx + 1}</td>
                      <td><strong>{p.customerName || p.customerId}</strong></td>
                      <td><code>{p.customerPhone || "—"}</code></td>
                      <td><strong>{p.spinQuota} lượt</strong></td>
                      <td>
                        <small className="badge-preview">
                          {p.registrationSource === "zalo_guest"
                            ? "Zalo Auto-Enroll"
                            : p.registrationSource === "import"
                            ? "Import Excel"
                            : "Admin thêm"}
                        </small>
                      </td>
                      <td>
                        <span className={`status-badge ${p.status === "active" ? "badge-active" : "badge-draft"}`}>
                          {p.status || "active"}
                        </span>
                      </td>
                      <td><small>{p.createdAt ? new Date(p.createdAt).toLocaleDateString("vi-VN") : "—"}</small></td>
                      <td>
                        <UiButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedCustomerId(p.customerId || p.id)}
                        >
                          Sửa
                        </UiButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                Hiển thị trang {page} / {totalPages} (Tổng: {totalCount} khách hàng)
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <UiButton
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    const newP = page - 1;
                    setPage(newP);
                    loadParticipants(newP, search);
                  }}
                >
                  Trang trước
                </UiButton>
                <UiButton
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const newP = page + 1;
                    setPage(newP);
                    loadParticipants(newP, search);
                  }}
                >
                  Trang sau
                </UiButton>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SECTION 2: IMPORT NEW PARTICIPANTS VIA FILE */}
      <div className="operator-card-section">
        <h3>Import thêm Khách từ File Excel / CSV</h3>
        
        <div style={{ marginBottom: "16px" }}>
          <label className="form-label" style={{ marginBottom: "8px", display: "block" }}>
            1. Chọn chế độ Import:
          </label>
          <div className="import-mode-selector">
            <label className={`mode-card ${importMode === "voucher" ? "selected" : ""}`}>
              <input
                type="radio"
                name="importModeSelect"
                value="voucher"
                checked={importMode === "voucher"}
                onChange={() => setImportMode("voucher")}
              />
              <div>
                <strong>Mô hình A: Cấp Voucher quà sẵn theo file</strong>
                <p>Mỗi khách có các mệnh giá Voucher cố định ghi trong cột Ghi chú (VD: 5 triệu, 3 triệu).</p>
              </div>
            </label>

            <label className={`mode-card ${importMode === "quota" ? "selected" : ""}`}>
              <input
                type="radio"
                name="importModeSelect"
                value="quota"
                checked={importMode === "quota"}
                onChange={() => setImportMode("quota")}
              />
              <div>
                <strong>Mô hình B: Cấp Lượt quay Khách sự kiện</strong>
                <p>Cấp số lượt quay cho khách để tự quay ngẫu nhiên theo Luật quay trong sự kiện.</p>
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="form-label" style={{ marginBottom: "8px", display: "block" }}>
            2. Chọn file Excel (.xlsx) hoặc CSV:
          </label>
          <div className="file-dropzone">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              id="file-upload-input"
              className="file-input"
            />
            <label htmlFor="file-upload-input" className="file-drop-label">
              <strong>{file ? file.name : "Kéo thả file Excel/CSV vào đây hoặc bấm để chọn file"}</strong>
              <small>Chấp nhận cột: Tên KH, SĐT, Số voucher tặng (hoặc Số lượt quay), Ghi chú, Nhóm khách</small>
            </label>
          </div>
        </div>
      </div>

      {rawRows.length > 0 && (
        <div className="operator-card-section">
          <div className="preview-header">
            <h3>Xem trước dữ liệu Import ({rawRows.length} dòng)</h3>
            <span className="badge-preview">Hiển thị 20 dòng đầu</span>
          </div>

          <div className="table-responsive">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Tên KH</th>
                  <th>Số điện thoại</th>
                  <th>Số lượng</th>
                  <th>Ghi chú / Mệnh giá</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => {
                  const name = row["Tên KH"] || row.name || row["Tên khách hàng"] || "—";
                  const phone = row["SĐT"] || row.phone || row["Số điện thoại"] || "—";
                  const count =
                    row["Số voucher tặng"] ??
                    row["Số vocher tặng"] ??
                    row["Số lượng"] ??
                    row.voucherCount ??
                    "—";
                  const note = row["Ghi chú"] || row.note || "—";

                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{name}</strong></td>
                      <td><code>{phone}</code></td>
                      <td>{count}</td>
                      <td><small>{note}</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="confirm-import-bar">
            <p>
              Kiểm tra các thông tin trên. Sau khi xác nhận, dữ liệu sẽ được ghi chính thức vào sự kiện{" "}
              <strong>{campaign?.name}</strong>.
            </p>
            <UiButton
              variant="primary"
              size="lg"
              onClick={() => setShowConfirmModal(true)}
              loading={importing}
            >
              Xác nhận Import dữ liệu
            </UiButton>
          </div>
        </div>
      )}

      {importResult && (
        <div className="operator-card-section result-box">
          <UiAlert
            type={importResult.errors && importResult.errors.length > 0 ? "warning" : "success"}
            title="Kết quả Import"
          >
            Đã nhập thành công <strong>{importResult.importedCount} / {importResult.totalRows}</strong> dòng.
          </UiAlert>

          {importResult.errors && importResult.errors.length > 0 && (
            <div className="error-list-container">
              <h4>Danh sách lỗi ({importResult.errors.length} dòng):</h4>
              <ul className="error-list">
                {importResult.errors.map((errStr, idx) => (
                  <li key={idx}>{errStr}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-actions mt-4">
            <UiButton variant="secondary" onClick={() => onNextStep("reward_mode")}>
              Tiếp tục: Cấu hình Mô hình phát thưởng -&gt;
            </UiButton>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title="Xác nhận Import Khách hàng"
        message={`Bạn có chắc chắn muốn Import ${rawRows.length} dòng dữ liệu khách hàng vào sự kiện '${campaign?.name || ""}' theo Mô hình ${importMode === "voucher" ? "A (Voucher cấp sẵn)" : "B (Cấp Lượt quay)"} không?`}
        confirmText="Xác nhận Import"
        cancelText="Hủy bỏ"
        variant="primary"
        loading={importing}
        onConfirm={executeImport}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* PARTICIPANT EDIT MODAL */}
      <ParticipantEditModal
        isOpen={Boolean(selectedCustomerId)}
        campaignId={campaign?.id}
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
        onSaved={() => loadParticipants(page, search)}
      />
    </div>
  );
}
