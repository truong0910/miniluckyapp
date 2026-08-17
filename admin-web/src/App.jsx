import { useEffect, useMemo, useState } from "react";
import { api, auth, downloadFile, fileToDataUrl, login, logout } from "./api.js";
import { parseCsvToRows, parseWorkbookToRows } from "./import-parser.js";

const EMPTY_REWARD = { codePrefix: "", title: "", value: "", description: "", wheelLabel: "", symbol: "star", active: true };
const EMPTY_BANNER = { title: "", imageUrl: "", linkUrl: "", active: true, order: 0 };
const EMPTY_CAMPAIGN = { code: "", name: "", startsAt: "", endsAt: "", timezone: "Asia/Ho_Chi_Minh" };

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event) => { event.preventDefault(); setError(""); try { await login(email, password); onLogin(); } catch (e) { setError(e.message); } };
  return <main className="login-shell"><form className="login-card" onSubmit={submit}><div className="eyebrow">LUCKY WHEELS</div><h1>Đăng nhập quản trị</h1><p>Backend riêng bảo vệ dữ liệu Supabase.</p><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Mật khẩu<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{error && <div className="error">{error}</div>}<button className="primary">Đăng nhập</button></form></main>;
}

function Shell({ tab, setTab, onLogout, children }) {
  return <div className="app-shell"><aside><div className="brand"><span>LW</span><div><strong>Lucky Wheels</strong><small>Admin Console</small></div></div><nav>{[["overview", "Tổng quan"], ["campaigns", "Sự kiện"], ["participants", "Khách sự kiện"], ["groups", "Nhóm khách"], ["banners", "Banner"], ["rewards", "Giải thưởng"], ["customers", "Khách hàng"], ["awards", "Kho Voucher"], ["campaign", "Luật quay"], ["rules", "Thể lệ"]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav><button className="logout" onClick={onLogout}>Đăng xuất</button></aside><main className="content">{children}</main></div>;
}

function Header({ title, subtitle }) { return <header className="page-header"><div><div className="eyebrow">ADMIN WEB · BACKEND API</div><h1>{title}</h1><p>{subtitle}</p></div></header>; }

function Overview() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/admin/campaigns").then((r) => {
      setCampaigns(r.items || []);
      if (r.items?.[0]) setSelectedCampaignId(r.items[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) return;
    api(`/admin/campaigns/${selectedCampaignId}/analytics`)
      .then(setAnalytics)
      .catch((e) => setError(e.message));
  }, [selectedCampaignId]);

  const exportCsv = async () => {
    if (!selectedCampaignId) return;
    try {
      await downloadFile(`/admin/campaigns/${selectedCampaignId}/export`, `campaign-${selectedCampaignId}.csv`);
    } catch (e) {
      setError(e.message);
    }
  };

  const m = analytics?.metrics || {};

  return (
    <>
      <Header title="Tổng quan Báo cáo (Dashboard)" subtitle="Theo dõi số liệu thực tế theo từng sự kiện và đồng bộ Google Sheets." />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-heading">
          <h2>Chọn sự kiện báo cáo:</h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} style={{ padding: "8px 12px" }}>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code}) — {c.status}</option>
              ))}
            </select>
            <button className="primary" onClick={exportCsv}>Xuất Báo cáo CSV</button>
          </div>
        </div>
        <div className="stats" style={{ marginTop: "16px" }}>
          <div className="stat"><span>Thành viên sự kiện</span><strong>{m.totalParticipants ?? "—"}</strong></div>
          <div className="stat"><span>Lượt quay đã cấp</span><strong>{m.totalAllocatedSpins ?? "—"}</strong></div>
          <div className="stat"><span>Lượt đã sử dụng</span><strong>{m.totalSpinsUsed ?? "—"}</strong></div>
          <div className="stat"><span>Voucher trúng</span><strong>{m.awardsTotal ?? "—"}</strong></div>
          <div className="stat"><span>Voucher đã đổi</span><strong>{m.awardsRedeemed ?? "—"}</strong></div>
        </div>
      </section>
      <section className="panel">
        <h2>Kiến trúc vận hành đa sự kiện</h2>
        <p>Hệ thống tự động đồng bộ kết quả từng lượt quay và voucher sang Google Sheets kèm <code>campaign_id</code> và <code>campaign_name</code> mà không xóa lịch sử cũ.</p>
        <div className="architecture"><span>Mini App</span><b>→</b><span>Backend :8787</span><b>←</b><span>Admin Web :5174</span><i>↕</i><span>Supabase & Google Sheets</span></div>
      </section>
    </>
  );
}

function Campaigns() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_CAMPAIGN);
  const [editing, setEditing] = useState(null);
  const [cloning, setCloning] = useState(null);
  const [cloneForm, setCloneForm] = useState({ code: "", name: "", cloneMode: "config_only" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const result = await api("/admin/campaigns?includeArchived=true");
      setItems(result.items || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...form };
      const path = editing ? `/admin/campaigns/${editing}` : "/admin/campaigns";
      await api(path, { method: editing ? "PUT" : "POST", body: JSON.stringify(body) });
      setForm(EMPTY_CAMPAIGN);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async (event) => {
    event.preventDefault();
    if (!cloning) return;
    setSaving(true);
    setError("");
    try {
      await api(`/admin/campaigns/${cloning.id}/clone`, {
        method: "POST",
        body: JSON.stringify(cloneForm),
      });
      setCloning(null);
      setCloneForm({ code: "", name: "", cloneMode: "config_only" });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, newStatus) => {
    if (newStatus === "active") {
      if (!confirm("Bạn có chắc chắn muốn KÍCH HOẠT sự kiện này?\nLưu ý: Nếu có sự kiện khác đang diễn ra, hệ thống sẽ báo lỗi và yêu cầu tạm dừng sự kiện đó trước.")) return;
    } else if (newStatus === "ended") {
      if (!confirm("Bạn có chắc chắn muốn KẾT THÚC sự kiện này?\nLưu ý: Thao tác này sẽ khóa nhận lượt quay mới.")) return;
    }
    setError("");
    try {
      await api(`/admin/campaigns/${id}/status`, { method: "POST", body: JSON.stringify({ status: newStatus }) });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <Header title="Quản lý Sự kiện (Campaigns)" subtitle="Tạo mới, nhân bản, thiết lập và chuyển đổi trạng thái vòng đời của từng sự kiện quay thưởng." />
      {error && <div className="error">{error}</div>}
      <div className="split">
        <form className="panel form" onSubmit={save}>
          <h2>{editing ? "Sửa thông tin sự kiện" : "Tạo sự kiện mới"}</h2>
          <label>Mã sự kiện<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VD: SUMMER_2026" required disabled={Boolean(editing && form.status !== "draft")} /></label>
          <label>Tên sự kiện<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Chương trình Vòng quay Mùa Hè 2026" required /></label>
          <div className="two">
            <label>Bắt đầu<input type="datetime-local" value={form.startsAt ? form.startsAt.slice(0, 16) : ""} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
            <label>Kết thúc<input type="datetime-local" value={form.endsAt ? form.endsAt.slice(0, 16) : ""} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
          </div>
          <div className="actions">
            <button className="primary" disabled={saving}>{saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm sự kiện"}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY_CAMPAIGN); }}>Hủy</button>}
          </div>
        </form>

        <section className="panel">
          <h2>Danh sách Sự kiện ({items.length})</h2>
          {cloning && (
            <form className="panel form" onSubmit={handleClone} style={{ border: "2px solid #ef7e3a", marginBottom: "16px" }}>
              <h2>Nhân bản sự kiện "{cloning.name}"</h2>
              <label>Mã sự kiện mới<input value={cloneForm.code} onChange={(e) => setCloneForm({ ...cloneForm, code: e.target.value })} placeholder="VD: SUMMER_2026_COPY" required /></label>
              <label>Tên sự kiện mới<input value={cloneForm.name} onChange={(e) => setCloneForm({ ...cloneForm, name: e.target.value })} placeholder="VD: Chương trình Mùa Hè 2026 (Copy)" required /></label>
              <label>Chế độ nhân bản
                <select value={cloneForm.cloneMode} onChange={(e) => setCloneForm({ ...cloneForm, cloneMode: e.target.value })}>
                  <option value="config_only">Chỉ nhân bản Cấu hình (Banner, Luật, Giải thưởng)</option>
                  <option value="config_and_audience">Cấu hình + Danh sách khách hàng & Voucher (Lượt quay = 0)</option>
                </select>
              </label>
              <div className="actions">
                <button className="primary" disabled={saving}>{saving ? "Đang nhân bản…" : "Xác nhận nhân bản"}</button>
                <button type="button" onClick={() => setCloning(null)}>Hủy</button>
              </div>
            </form>
          )}
          <div className="items">
            {items.map((item) => (
              <article className="item reward-item" key={item.id}>
                <div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <strong>{item.name}</strong>
                    <span className={`badge status-${item.status}`}>{item.status}</span>
                  </div>
                  <small>Mã: <code>{item.code}</code> · Múi giờ: {item.timezone}</small>
                  {(item.startsAt || item.endsAt) && (
                    <small>Thời gian: {item.startsAt ? new Date(item.startsAt).toLocaleString("vi-VN") : "Bắt đầu mở"} → {item.endsAt ? new Date(item.endsAt).toLocaleString("vi-VN") : "Không giới hạn"}</small>
                  )}
                </div>
                <div className="actions" style={{ flexWrap: "wrap" }}>
                  <button onClick={() => { setCloning(item); setCloneForm({ code: `${item.code}_COPY`, name: `${item.name} (Copy)`, cloneMode: "config_only" }); }}>Nhân bản</button>
                  {item.status === "draft" && (
                    <>
                      <button onClick={() => { setEditing(item.id); setForm(item); }}>Sửa</button>
                      <button className="primary" onClick={() => setStatus(item.id, "active")}>Kích hoạt</button>
                      <button className="danger" onClick={() => setStatus(item.id, "archived")}>Lưu trữ</button>
                    </>
                  )}
                  {item.status === "active" && (
                    <>
                      <button onClick={() => setStatus(item.id, "paused")}>Tạm dừng</button>
                      <button className="danger" onClick={() => setStatus(item.id, "ended")}>Kết thúc</button>
                    </>
                  )}
                  {item.status === "paused" && (
                    <>
                      <button className="primary" onClick={() => setStatus(item.id, "active")}>Kích hoạt lại</button>
                      <button className="danger" onClick={() => setStatus(item.id, "ended")}>Kết thúc</button>
                      <button onClick={() => setStatus(item.id, "archived")}>Lưu trữ</button>
                    </>
                  )}
                  {item.status === "ended" && (
                    <button onClick={() => setStatus(item.id, "archived")}>Lưu trữ</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function CampaignParticipants() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState("voucher");
  const [importRowsJson, setImportRowsJson] = useState("");
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    api("/admin/campaigns").then((r) => {
      setCampaigns(r.items || []);
      if (r.items?.[0]) setSelectedCampaignId(r.items[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  const load = async () => {
    if (!selectedCampaignId) return;
    setLoading(true);
    setError("");
    try {
      const result = await api(`/admin/campaigns/${selectedCampaignId}/participants`);
      setParticipants(result.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedCampaignId]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    const isWorkbook = /\.(xlsx|xls)$/i.test(file.name);
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result || "";
        if (file.name.toLowerCase().endsWith(".json")) {
          setImportRowsJson(typeof content === "string" ? content : "");
        } else {
          const rows = isWorkbook ? parseWorkbookToRows(content) : parseCsvToRows(content);
          setImportRowsJson(JSON.stringify(rows, null, 2));
        }
        setError("");
      } catch (error) {
        setError(`Không đọc được file ${file.name}: ${error.message}`);
      }
    };
    if (isWorkbook) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, "UTF-8");
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setImportResult(null);
    setError("");
    try {
      let rows = [];
      try {
        rows = JSON.parse(importRowsJson);
      } catch (err) {
        throw new Error("Dữ liệu JSON nhập vào không đúng định dạng array objects [{ \"Tên KH\": \"...\", \"SĐT\": \"...\", \"Số voucher tặng\": \"...\", \"Ghi chú\": \"...\" }]");
      }

      if (!Array.isArray(rows) || rows.length === 0) throw new Error("Danh sách nhập không được để trống");

      const result = await api(`/admin/campaigns/${selectedCampaignId}/participants/import`, {
        method: "POST",
        body: JSON.stringify({ rows, importMode }),
      });

      setImportResult(result);
      if (result.importedCount > 0) {
        await load();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <Header title="Khách hàng sự kiện & Import Excel" subtitle="Quản lý danh sách thành viên tham gia sự kiện và cấp voucher / lượt quay từ file Excel." />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-heading">
          <h2>Chọn sự kiện:</h2>
          <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} style={{ padding: "8px 12px" }}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code}) — {c.status}</option>
            ))}
          </select>
          <button className="primary" onClick={() => setImporting(!importing)}>
            {importing ? "Đóng Import" : "Nhập danh sách Excel / CSV"}
          </button>
        </div>

        {importing && (
          <div className="panel inline-form" style={{ border: "2px solid #ef7e3a", marginTop: "16px" }}>
            <h2>Nhập danh sách Khách hàng từ Excel / CSV</h2>
            <p style={{ fontSize: "13px", color: "#666" }}>Tải lên file Excel CSV (.csv) chứa các cột: <code>Tên KH</code>, <code>SĐT</code>, <code>Số voucher tặng</code>, <code>Ghi chú</code>.</p>
            <form onSubmit={handleImport} style={{ display: "grid", gap: "12px" }}>
              <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "8px", border: "1px dashed #ccc" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>
                  1. Chọn file CSV / Excel từ máy tính:
                </label>
                <input
                  type="file"
                  accept=".csv,.txt,.json,.xlsx,.xls"
                  onChange={handleFileUpload}
                  style={{ padding: "6px" }}
                />
              </div>
              <label>2. Chế độ cấp:
                <select value={importMode} onChange={(e) => setImportMode(e.target.value)}>
                  <option value="voucher">Cấp Voucher cụ thể từ cột Ghi chú (VD: '5 triệu, 3 triệu')</option>
                  <option value="quota">Cấp Lượt quay từ cột Số voucher tặng</option>
                </select>
              </label>
              <label style={{ fontSize: "12px", color: "#666" }}>Xem trước dữ liệu hàng (Rows Preview JSON):</label>
              <textarea
                rows="5"
                placeholder='Tự động điền khi chọn file CSV/Excel ở trên...'
                value={importRowsJson}
                onChange={(e) => setImportRowsJson(e.target.value)}
                required
              />
              <button className="primary">Tiến hành Import dữ liệu</button>
            </form>
            {importResult && (
              <div style={{ marginTop: "12px", padding: "12px", background: importResult.success ? "#e6f4ea" : "#fff1f1", borderRadius: "8px" }}>
                <strong>Kết quả Import:</strong> Đã nhập thành công {importResult.importedCount}/{importResult.totalRows} dòng.
                {importResult.errors?.length > 0 && (
                  <ul style={{ color: "#c14848", margin: "8px 0 0", paddingLeft: "20px" }}>
                    {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <div className="table-wrap" style={{ marginTop: "16px" }}>
          <table>
            <thead>
              <tr>
                <th>Tên Khách hàng</th>
                <th>Số điện thoại</th>
                <th>Lượt quay sự kiện</th>
                <th>Ghi chú / Nhóm</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: "center", padding: "24px" }}>Đang tải...</td></tr>
              ) : participants.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: "center", padding: "24px" }}>Sự kiện chưa có khách hàng nào. Bấm "Nhập danh sách Excel" để thêm.</td></tr>
              ) : (
                participants.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.customerName}</strong></td>
                    <td>{item.customerPhone || item.customerId}</td>
                    <td>{item.spinQuota} lượt</td>
                    <td>{item.importedGroup || "—"}</td>
                    <td><span className={`badge status-${item.status}`}>{item.status}</span></td>
                    <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Banners() {
  const [items, setItems] = useState([]); const [form, setForm] = useState(EMPTY_BANNER); const [editing, setEditing] = useState(null); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const load = async () => { try { const result = await api("/admin/banners"); setItems(result.items || []); } catch (e) { setError(e.message); } };
  useEffect(() => { void load(); }, []);
  const save = async (event) => { event.preventDefault(); setSaving(true); setError(""); try { const body = { ...form }; const path = editing ? `/admin/banners/${editing}` : "/admin/banners"; await api(path, { method: editing ? "PUT" : "POST", body: JSON.stringify(body) }); setForm(EMPTY_BANNER); setEditing(null); await load(); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  const upload = async (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 8_000_000) { setError("Ảnh tối đa 8MB"); return; } const imageData = await fileToDataUrl(file); setForm((x) => ({ ...x, imageData, imageUrl: "" })); };
  const remove = async (id) => { if (!confirm("Xóa banner này?")) return; try { await api(`/admin/banners/${id}`, { method: "DELETE" }); await load(); } catch (e) { setError(e.message); } };
  return <><Header title="Quản lý banner" subtitle="Ảnh được lưu trên Supabase Storage, không nhúng data URL vào Mini App." />{error && <div className="error">{error}</div>}<div className="split"><form className="panel form" onSubmit={save}><h2>{editing ? "Sửa banner" : "Thêm banner"}</h2><label>Tiêu đề<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>URL ảnh<input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value, imageData: undefined })} placeholder="https://..." /></label><label>Hoặc tải file<input type="file" accept="image/*" onChange={upload} /></label>{(form.imageUrl || form.imageData) && <img className="banner-preview" src={form.imageData || form.imageUrl} /> }<label>Link khi bấm<input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} /></label><label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Hiển thị</label><div className="actions"><button className="primary" disabled={saving}>{saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm banner"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY_BANNER); }}>Hủy</button>}</div></form><section className="panel"><h2>Danh sách ({items.length})</h2><div className="items">{items.map((item) => <article className="item" key={item.id}><img src={item.imageUrl} /><div><strong>{item.title}</strong><small>{item.active ? "Đang hiển thị" : "Đang tắt"}</small><div className="actions"><button onClick={() => { setEditing(item.id); setForm(item); }}>Sửa</button><button className="danger" onClick={() => remove(item.id)}>Xóa</button></div></div></article>)}</div></section></div></>;
}

function Rewards() {
  const [items, setItems] = useState([]); const [form, setForm] = useState(EMPTY_REWARD); const [editing, setEditing] = useState(null); const [error, setError] = useState("");
  const load = async () => { try { const result = await api("/admin/rewards"); setItems(result.items || []); } catch (e) { setError(e.message); } };
  useEffect(() => { void load(); }, []);
  const save = async (event) => { event.preventDefault(); setError(""); try { const body = { ...form, value: Number(form.value) }; await api(editing ? `/admin/rewards/${editing}` : "/admin/rewards", { method: editing ? "PUT" : "POST", body: JSON.stringify(body) }); setForm(EMPTY_REWARD); setEditing(null); await load(); } catch (e) { setError(e.message); } };
  const remove = async (id) => { if (!confirm("Xóa giải thưởng này?")) return; try { await api(`/admin/rewards/${id}`, { method: "DELETE" }); await load(); } catch (e) { setError(e.message); } };
  return <><Header title="Giải thưởng & Tồn kho" subtitle="Mọi nơi hiển thị giải thưởng đều đọc từ danh mục này." />{error && <div className="error">{error}</div>}<div className="split"><form className="panel form" onSubmit={save}><h2>{editing ? "Sửa quà" : "Thêm quà"}</h2><label>Tên giải thưởng<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label><label>Mã quà<input value={form.codePrefix} onChange={(e) => setForm({ ...form, codePrefix: e.target.value })} required /></label><div className="two"><label>Giá trị<input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required /></label><label>Nhãn vòng quay<input value={form.wheelLabel} onChange={(e) => setForm({ ...form, wheelLabel: e.target.value })} /></label></div><label>Mô tả<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Biểu tượng<select value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })}><option value="star">Ngôi sao</option><option value="bell">Chuông</option><option value="red_envelope">Phong bao</option><option value="cherry">Cherry</option><option value="lemon">Lemon</option></select></label><label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Hiển thị trên vòng quay</label><div className="actions"><button className="primary">{editing ? "Lưu thay đổi" : "Thêm quà"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY_REWARD); }}>Hủy</button>}</div></form><section className="panel"><h2>Danh mục ({items.length})</h2><div className="items">{items.map((item) => <article className="item reward-item" key={item.id}><div><strong>{item.title}</strong><small>{item.value.toLocaleString("vi-VN")}đ · {item.codePrefix} · {item.active ? "Đang bật" : "Đang tắt"}</small></div><div className="actions"><button onClick={() => { setEditing(item.id); setForm(item); }}>Sửa</button><button className="danger" onClick={() => remove(item.id)}>Xóa</button></div></article>)}</div></section></div></>;
}

function Customers() {
  const [items, setItems] = useState([]); const [search, setSearch] = useState(""); const [error, setError] = useState(""); const [form, setForm] = useState({ name: "", phone: "", totalSpins: 5 });
  const load = () => api(`/admin/customers?search=${encodeURIComponent(search)}`).then((r) => setItems(r.items || [])).catch((e) => setError(e.message)); useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [search]);
  const add = async (event) => { event.preventDefault(); try { await api("/admin/customers", { method: "POST", body: JSON.stringify({ ...form, totalSpins: Number(form.totalSpins) }) }); setForm({ name: "", phone: "", totalSpins: 5 }); await load(); } catch (e) { setError(e.message); } };
  const remove = async (id) => { if (!confirm("Ẩn khách hàng này?")) return; try { await api(`/admin/customers/${id}`, { method: "DELETE" }); await load(); } catch (e) { setError(e.message); } };
  return <><Header title="Khách hàng" subtitle="Thêm khách thủ công và kiểm tra số lượt quay được cấp." />{error && <div className="error">{error}</div>}<section className="panel inline-form"><h2>Thêm khách hàng</h2><form onSubmit={add}><input placeholder="Họ tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input placeholder="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /><input type="number" min="0" placeholder="Lượt quay" value={form.totalSpins} onChange={(e) => setForm({ ...form, totalSpins: e.target.value })} /><button className="primary">Thêm</button></form></section><section className="panel"><div className="panel-heading"><h2>Danh sách ({items.length})</h2><input placeholder="Tìm tên hoặc số điện thoại" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="table-wrap"><table><thead><tr><th>Tên</th><th>Số điện thoại</th><th>Lượt cấp</th><th>Voucher</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.phone}</td><td>{item.totalSpins}</td><td>{item.rewards?.length || 0}</td><td><button className="danger" onClick={() => remove(item.id)}>Ẩn</button></td></tr>)}</tbody></table></div></section></>;
}

function Awards() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api(`/admin/awards?page=${page}&limit=20&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`);
      setItems(result.items || []);
      setTotal(result.total || 0);
      setHasMore(result.hasMore || false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [page, status, search]);

  const redeem = async (id) => {
    if (!confirm("Xác nhận đổi thưởng cho Voucher này?")) return;
    setError("");
    try {
      await api(`/admin/awards/${id}/redeem`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const resend = async (id) => {
    if (!confirm("Gửi lại tin nhắn ZNS cho Voucher này?")) return;
    setError("");
    try {
      await api(`/admin/awards/${id}/resend`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const changeStatus = async (id, targetStatus) => {
    const reason = prompt(`Nhập lý do chuyển trạng thái sang ${targetStatus.toUpperCase()}:`);
    if (!reason || !reason.trim()) {
      alert("Cần nhập lý do hợp lệ.");
      return;
    }
    setError("");
    try {
      await api(`/admin/awards/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: targetStatus, reason: reason.trim() }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <Header title="Kho Voucher & Vận hành Awards" subtitle="Tra cứu, đổi thưởng, gửi lại ZNS và hủy/chuyển hết hạn voucher của khách hàng." />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-heading">
          <h2>Danh sách Voucher ({total})</h2>
          <div className="filters" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Tất cả trạng thái</option>
              <option value="issued">Đã cấp (Issued)</option>
              <option value="delivering">Đang gửi (Delivering)</option>
              <option value="delivered">Đã gửi ZNS (Delivered)</option>
              <option value="redeemed">Đã đổi (Redeemed)</option>
              <option value="expired">Đã hết hạn (Expired)</option>
              <option value="void">Đã hủy (Void)</option>
            </select>
            <input placeholder="Tìm theo mã voucher hoặc tên quà" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã Voucher</th>
                <th>Tên Khách hàng</th>
                <th>Số điện thoại</th>
                <th>Phần thưởng</th>
                <th>Giá trị</th>
                <th>Trạng thái</th>
                <th>Ngày cấp</th>
                <th>Vận hành</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: "center", padding: "24px" }}>Đang tải dữ liệu...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: "center", padding: "24px" }}>Không tìm thấy voucher nào.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td><strong style={{ fontFamily: "monospace" }}>{item.code}</strong></td>
                  <td>{item.customerName}</td>
                  <td>{item.customerPhone || item.customerId}</td>
                  <td>{item.title}</td>
                  <td>{item.value ? `${item.value.toLocaleString("vi-VN")}đ` : "—"}</td>
                  <td><span className={`badge status-${item.status}`}>{item.status}</span></td>
                  <td>{item.issuedAt ? new Date(item.issuedAt).toLocaleString("vi-VN") : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {item.status !== "redeemed" && (item.status === "issued" || item.status === "delivered") && (
                      <button className="primary" style={{ padding: "4px 8px", fontSize: "11px", marginRight: "4px" }} onClick={() => redeem(item.id)}>Đổi thưởng</button>
                    )}
                    {item.status !== "redeemed" && (
                      <button style={{ padding: "4px 8px", fontSize: "11px", marginRight: "4px" }} onClick={() => resend(item.id)}>Gửi lại ZNS</button>
                    )}
                    {item.status !== "redeemed" && item.status !== "void" && item.status !== "expired" && (
                      <button className="danger" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => changeStatus(item.id, "void")}>Hủy</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
          <span>Trang {page} ({items.length}/{total})</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trang trước</button>
            <button disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Trang sau</button>
          </div>
        </div>
      </section>
    </>
  );
}

function Rules() {
  const [rules, setRules] = useState({ intro: "", eligibility: [], rewards: [], usageNotes: [] }); const [error, setError] = useState("");
  useEffect(() => { api("/admin/rules").then((r) => r.rules && setRules({ ...rules, ...r.rules })).catch((e) => setError(e.message)); }, []);
  const save = async (event) => { event.preventDefault(); try { await api("/admin/rules", { method: "PUT", body: JSON.stringify(rules) }); } catch (e) { setError(e.message); } };
  const lines = (key) => Array.isArray(rules[key]) ? rules[key].join("\n") : "";
  return <><Header title="Thể lệ chương trình" subtitle="Nội dung này được Mini App đọc qua Backend API." />{error && <div className="error">{error}</div>}<form className="panel form rules" onSubmit={save}><label>Giới thiệu<textarea value={rules.intro} onChange={(e) => setRules({ ...rules, intro: e.target.value })} /></label>{[["eligibility", "Điều kiện tham gia"], ["rewards", "Cơ cấu giải thưởng"], ["usageNotes", "Quy định sử dụng Voucher"]].map(([key, label]) => <label key={key}>{label}<textarea rows="5" value={lines(key)} onChange={(e) => setRules({ ...rules, [key]: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} /></label>)}<button className="primary">Lưu thể lệ</button></form></>;
}

function CampaignRules() {
  const EMPTY = { name: "", code: "", scope: "default", priority: 0, spinNumber: 1, winRate: 0, rewardId: "", probability: 100, quantity: 1, maxTotalWins: "", oaRequired: false, active: true };
  const [items, setItems] = useState([]); const [rewards, setRewards] = useState([]); const [campaigns, setCampaigns] = useState([]); const [campaignId, setCampaignId] = useState(""); const [form, setForm] = useState(EMPTY); const [editing, setEditing] = useState(null); const [error, setError] = useState("");
  const load = async () => { try { const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ""; const [rules, catalog] = await Promise.all([api(`/admin/campaign-rules${query}`), api("/admin/rewards")]); setItems(rules.items || []); setRewards(catalog.items || []); if (!form.rewardId && catalog.items?.[0]) setForm((x) => ({ ...x, rewardId: catalog.items[0].id })); } catch (e) { setError(e.message); } };
  useEffect(() => { api("/admin/campaigns").then((result) => { const available = result.items || []; setCampaigns(available); if (!campaignId && available[0]) setCampaignId(available[0].id); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => { void load(); }, [campaignId]);
  const save = async (event) => { event.preventDefault(); setError(""); try { const body = { campaignId, name: form.name, code: form.code, scope: form.scope, priority: Number(form.priority), maxTotalWins: form.maxTotalWins, oaRequired: form.oaRequired, active: form.active, spins: [{ spinNumber: Number(form.spinNumber), winRate: Number(form.winRate), rewards: [{ rewardId: form.rewardId, probability: Number(form.probability), quantity: Number(form.quantity), remainingQuantity: Number(form.quantity) }] }] }; await api(editing ? `/admin/campaign-rules/${editing}` : "/admin/campaign-rules", { method: editing ? "PUT" : "POST", body: JSON.stringify(body) }); setForm(EMPTY); setEditing(null); await load(); } catch (e) { setError(e.message); } };
  const edit = (item) => { const spin = item.spins?.[0]; const reward = spin?.rewards?.[0]; setEditing(item.id); setForm({ ...EMPTY, name: item.name, code: item.code, scope: item.scope, priority: item.priority, maxTotalWins: item.max_total_wins ?? "", oaRequired: item.oa_required, active: item.active, spinNumber: spin?.spin_number || 1, winRate: spin?.win_rate || 0, rewardId: reward?.reward_id || rewards[0]?.id || "", probability: reward?.probability || 100, quantity: reward?.quantity || 1 }); };
  const remove = async (id) => { if (!confirm("Xóa rule này?")) return; try { await api(`/admin/campaign-rules/${id}`, { method: "DELETE" }); await load(); } catch (e) { setError(e.message); } };
  return <><Header title="Luật quay" subtitle="Cấu hình tỷ lệ thắng từng lượt, tỷ lệ từng quà, số lượng, giới hạn và điều kiện OA." />{error && <div className="error">{error}</div>}<div className="split"><form className="panel form" onSubmit={save}><h2>{editing ? "Sửa rule" : "Tạo rule"}</h2><label>Sự kiện<select value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setEditing(null); setForm(EMPTY); }} required>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} ({campaign.code})</option>)}</select></label><label>Tên rule<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Mã rule<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DEFAULT_2026" /></label><div className="two"><label>Phạm vi<select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}><option value="default">Default</option><option value="user">Khách hàng</option><option value="group">Nhóm khách</option></select></label><label>Độ ưu tiên<input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></label></div><div className="two"><label>Lượt thứ<input type="number" min="1" value={form.spinNumber} onChange={(e) => setForm({ ...form, spinNumber: e.target.value })} /></label><label>Tỷ lệ thắng lượt (%)<input type="number" min="0" max="100" value={form.winRate} onChange={(e) => setForm({ ...form, winRate: e.target.value })} /></label></div><label>Giải thưởng<select value={form.rewardId} onChange={(e) => setForm({ ...form, rewardId: e.target.value })}>{rewards.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="two"><label>Tỷ lệ quà (%)<input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} /></label><label>Số lượng quà<input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label></div><label>Giới hạn tổng số lần trúng<input type="number" min="0" value={form.maxTotalWins} onChange={(e) => setForm({ ...form, maxTotalWins: e.target.value })} placeholder="Không giới hạn" /></label><label className="check"><input type="checkbox" checked={form.oaRequired} onChange={(e) => setForm({ ...form, oaRequired: e.target.checked })} /> Bắt buộc theo dõi OA</label><label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Đang áp dụng</label><div className="actions"><button className="primary">{editing ? "Lưu rule" : "Tạo rule"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }}>Hủy</button>}</div></form><section className="panel"><h2>Danh sách rule ({items.length})</h2><div className="items">{items.map((item) => <article className="item reward-item" key={item.id}><div><strong>{item.name}</strong><small>{item.scope} · ưu tiên {item.priority} · {item.active ? "Đang bật" : "Đang tắt"}</small><small>{item.spins?.length || 0} cấu hình lượt quay</small></div><div className="actions"><button onClick={() => edit(item)}>Sửa</button><button className="danger" onClick={() => remove(item.id)}>Xóa</button></div></article>)}</div></section></div></>;
}

function CustomerGroups() {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [members, setMembers] = useState([]);
  const [groupRules, setGroupRules] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignRules, setCampaignRules] = useState([]);

  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState(null);
  const [renamingName, setRenamingName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedCustomerIdToAdd, setSelectedCustomerIdToAdd] = useState("");
  const [error, setError] = useState("");

  const loadGroups = async () => {
    try {
      const res = await api("/admin/groups");
      const list = res.items || [];
      setGroups(list);
      if (!selectedGroupId && list[0]) setSelectedGroupId(list[0].id);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadMembersAndRules = async () => {
    if (!selectedGroupId) return;
    try {
      const [mRes, rRes] = await Promise.all([
        api(`/admin/groups/${selectedGroupId}/members`),
        api(`/admin/groups/${selectedGroupId}/rules`),
      ]);
      setMembers(mRes.items || []);
      setGroupRules(rRes.items || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { void loadGroups(); }, []);
  useEffect(() => { void loadMembersAndRules(); }, [selectedGroupId]);

  useEffect(() => {
    api("/admin/customers").then((r) => setAllCustomers(r.items || [])).catch(() => {});
    api("/admin/campaigns").then((r) => {
      const available = r.items || [];
      setCampaigns(available);
      if (!selectedCampaignId && available[0]) setSelectedCampaignId(available[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) return;
    api(`/admin/campaign-rules?campaignId=${encodeURIComponent(selectedCampaignId)}`)
      .then((r) => setCampaignRules(r.items || []))
      .catch(() => {});
  }, [selectedCampaignId]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const created = await api("/admin/groups", {
        method: "POST",
        body: JSON.stringify({ name: newGroupName }),
      });
      setNewGroupName("");
      setSelectedGroupId(created.id);
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRenameGroup = async (id) => {
    if (!renamingName.trim()) return;
    setError("");
    try {
      await api(`/admin/groups/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: renamingName.trim() }),
      });
      setRenamingGroupId(null);
      setRenamingName("");
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteGroup = async (id, name) => {
    if (!confirm(`Xóa nhóm '${name}'? Thao tác này chỉ xóa liên kết nhóm, giữ nguyên thông tin khách hàng và lịch sử.`)) return;
    setError("");
    try {
      await api(`/admin/groups/${id}`, { method: "DELETE" });
      if (selectedGroupId === id) setSelectedGroupId("");
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedGroupId || !selectedCustomerIdToAdd) return;
    setError("");
    try {
      await api(`/admin/groups/${selectedGroupId}/members/${selectedCustomerIdToAdd}`, { method: "POST" });
      setSelectedCustomerIdToAdd("");
      await loadMembersAndRules();
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (customerId) => {
    if (!selectedGroupId) return;
    setError("");
    try {
      await api(`/admin/groups/${selectedGroupId}/members/${customerId}`, { method: "DELETE" });
      await loadMembersAndRules();
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleRuleAssignment = async (ruleId, assigned) => {
    if (!selectedGroupId) return;
    setError("");
    try {
      if (assigned) {
        await api(`/admin/groups/${selectedGroupId}/rules/${ruleId}`, { method: "DELETE" });
      } else {
        await api(`/admin/groups/${selectedGroupId}/rules/${ruleId}`, { method: "POST" });
      }
      await loadMembersAndRules();
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredCustomersForAdd = allCustomers.filter((c) => {
    if (members.some((m) => m.customerId === c.id)) return false;
    if (!memberSearch) return true;
    const s = memberSearch.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.id.includes(s);
  });

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <>
      <Header title="Nhóm khách hàng (Customer Groups)" subtitle="Phân nhóm khách hàng (VIP, Đại lý, Nội bộ) để gán thể lệ/luật quay đặc thù theo từng sự kiện." />
      {error && <div className="error">{error}</div>}
      <div className="split">
        <section className="panel">
          <div className="panel-heading">
            <h2>Tạo nhóm mới</h2>
          </div>
          <form className="form" onSubmit={handleCreateGroup}>
            <label>Tên nhóm khách
              <input
                placeholder="VD: Khách hàng VIP, Đại lý..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
              />
            </label>
            <button className="primary">Tạo nhóm</button>
          </form>

          <div className="panel-heading" style={{ marginTop: "24px" }}>
            <h2>Danh sách nhóm ({groups.length})</h2>
          </div>
          <div className="items">
            {groups.map((g) => (
              <article
                className={`item reward-item ${selectedGroupId === g.id ? "active" : ""}`}
                key={g.id}
                style={{ cursor: "pointer", borderLeft: selectedGroupId === g.id ? "4px solid #ef7e3a" : "none" }}
                onClick={() => setSelectedGroupId(g.id)}
              >
                <div>
                  {renamingGroupId === g.id ? (
                    <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        value={renamingName}
                        onChange={(e) => setRenamingName(e.target.value)}
                        style={{ padding: "4px 8px" }}
                      />
                      <button className="primary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleRenameGroup(g.id)}>Lưu</button>
                      <button style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => setRenamingGroupId(null)}>Hủy</button>
                    </div>
                  ) : (
                    <strong>{g.name}</strong>
                  )}
                  <small>{g.memberCount} thành viên · {g.ruleCount} luật được gán</small>
                </div>
                <div className="actions" onClick={(e) => e.stopPropagation()}>
                  {renamingGroupId !== g.id && (
                    <button style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => { setRenamingGroupId(g.id); setRenamingName(g.name); }}>Sửa</button>
                  )}
                  <button className="danger" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleDeleteGroup(g.id, g.name)}>Xóa</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div>
          {selectedGroup ? (
            <>
              <section className="panel" style={{ marginBottom: "16px" }}>
                <div className="panel-heading">
                  <h2>Thành viên nhóm: {selectedGroup.name} ({members.length})</h2>
                </div>
                <form className="form" onSubmit={handleAddMember} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", alignItems: "end" }}>
                  <label style={{ margin: 0 }}>Tìm theo Tên / SĐT
                    <input
                      placeholder="Tìm khách hàng..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                  </label>
                  <label style={{ margin: 0 }}>Chọn khách hàng
                    <select
                      value={selectedCustomerIdToAdd}
                      onChange={(e) => setSelectedCustomerIdToAdd(e.target.value)}
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {filteredCustomersForAdd.slice(0, 50).map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                      ))}
                    </select>
                  </label>
                  <button className="primary" disabled={!selectedCustomerIdToAdd}>Thêm vào nhóm</button>
                </form>

                <div className="table-wrap" style={{ marginTop: "12px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Tên Khách hàng</th>
                        <th>Số điện thoại</th>
                        <th>Mã Khách hàng</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length === 0 ? (
                        <tr><td colSpan="4" style={{ textAlign: "center", padding: "16px" }}>Chưa có thành viên nào trong nhóm này.</td></tr>
                      ) : (
                        members.map((m) => (
                          <tr key={m.customerId}>
                            <td><strong>{m.customerName}</strong></td>
                            <td>{m.customerPhone}</td>
                            <td><code>{m.customerId}</code></td>
                            <td>
                              <button className="danger" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleRemoveMember(m.customerId)}>Loại khỏi nhóm</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h2>Gán Luật quay theo Sự kiện</h2>
                  <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} style={{ padding: "6px 12px" }}>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: "13px", color: "#666" }}>Chọn luật quay thuộc sự kiện để áp dụng cho thành viên nhóm <strong>{selectedGroup.name}</strong>:</p>
                <div className="items" style={{ marginTop: "12px" }}>
                  {campaignRules.length === 0 ? (
                    <div style={{ padding: "12px", color: "#888" }}>Sự kiện này chưa có luật quay nào.</div>
                  ) : (
                    campaignRules.map((rule) => {
                      const isAssigned = groupRules.some((gr) => gr.ruleId === rule.id);
                      return (
                        <article className="item reward-item" key={rule.id}>
                          <div>
                            <strong>{rule.name}</strong>
                            <small>Mã: <code>{rule.code}</code> · Phạm vi: {rule.scope} · Ưu tiên: {rule.priority}</small>
                          </div>
                          <button
                            className={isAssigned ? "danger" : "primary"}
                            style={{ padding: "6px 12px", fontSize: "12px" }}
                            onClick={() => handleToggleRuleAssignment(rule.id, isAssigned)}
                          >
                            {isAssigned ? "Hủy gán" : "Gán cho nhóm"}
                          </button>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="panel">
              <p style={{ padding: "24px", textAlign: "center", color: "#888" }}>Vui lòng chọn hoặc tạo một nhóm khách hàng để xem thông tin chi tiết.</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(auth.token));
  const [tab, setTab] = useState("overview");

  const page = useMemo(() => ({
    overview: <Overview />,
    campaigns: <Campaigns />,
    participants: <CampaignParticipants />,
    groups: <CustomerGroups />,
    banners: <Banners />,
    rewards: <Rewards />,
    customers: <Customers />,
    awards: <Awards />,
    rules: <Rules />,
    campaign: <CampaignRules />,
  }[tab]), [tab]);

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  return <Shell tab={tab} setTab={setTab} onLogout={() => { logout(); setLoggedIn(false); }}>{page}</Shell>;
}
