import { useState } from "react";
import { api, downloadFile } from "../../api.js";
import { parseCsvToRows, parseWorkbookToRows } from "../../import-parser.js";

export default function AudienceImportStep({ campaign, onNextStep }) {
  const [file, setFile] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [importMode, setImportMode] = useState("voucher");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState("");

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
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const previewRows = rawRows.slice(0, 20);

  return (
    <div className="operator-step-container">
      <div className="step-header-banner">
        <div>
          <h2>👥 Thêm Khách tham gia & Import Excel</h2>
          <p>Tải danh sách khách tham gia sự kiện <strong>{campaign?.name}</strong> từ file Excel/CSV.</p>
        </div>
      </div>

      {error && <div className="error-card">⚠️ {error}</div>}

      <div className="operator-card-section">
        <h3>1. Chọn chế độ Import khách hàng</h3>
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
              <strong>🎁 Mô hình A: Cấp Voucher quà sẵn theo file</strong>
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
              <strong>🎯 Mô hình B: Cấp Lượt quay Khách sự kiện</strong>
              <p>Cấp số lượt quay cho khách để tự quay ngẫu nhiên theo Luật quay trong sự kiện.</p>
            </div>
          </label>
        </div>
      </div>

      <div className="operator-card-section">
        <h3>2. Chọn file Excel (.xlsx) hoặc CSV</h3>
        <div className="file-dropzone">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            id="file-upload-input"
            className="file-input"
          />
          <label htmlFor="file-upload-input" className="file-drop-label">
            <span className="upload-icon">📁</span>
            <strong>{file ? file.name : "Kéo thả file Excel/CSV vào đây hoặc bấm để chọn file"}</strong>
            <small>Chấp nhận cột: Tên KH, SĐT, Số voucher tặng (hoặc Số lượt quay), Ghi chú, Nhóm khách</small>
          </label>
        </div>
      </div>

      {rawRows.length > 0 && (
        <div className="operator-card-section">
          <div className="preview-header">
            <h3>3. Xem trước dữ liệu ({rawRows.length} dòng)</h3>
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
            <button
              type="button"
              className="btn-primary-lg"
              onClick={executeImport}
              disabled={importing}
            >
              {importing ? "Đang xử lý Import..." : "✅ Xác nhận Import dữ liệu"}
            </button>
          </div>
        </div>
      )}

      {importResult && (
        <div className="operator-card-section result-box">
          <h3>🎉 Kết quả Import</h3>
          <p className="result-stat">
            Đã nhập thành công <strong>{importResult.importedCount} / {importResult.totalRows}</strong> dòng.
          </p>

          {importResult.errors && importResult.errors.length > 0 && (
            <div className="error-list-container">
              <h4>Danh sách lỗi ({importResult.errors.length} dòng):</h4>
              <ul className="error-list">
                {importResult.errors.map((errStr, idx) => (
                  <li key={idx}>⚠️ {errStr}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-actions mt-4">
            <button className="btn-secondary" onClick={() => onNextStep("reward_mode")}>
              Tiếp tục: Cấu hình Mô hình phát thưởng ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
