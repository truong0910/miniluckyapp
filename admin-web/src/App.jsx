import { useEffect, useMemo, useState } from "react";
import { api, auth, downloadFile, fileToDataUrl, login, logout, setUnauthorizedHandler } from "./api.js";
import { parseCsvToRows, parseWorkbookToRows } from "./import-parser.js";
import EventWorkspace from "./features/operator/EventWorkspace.jsx";
import EventWizard from "./features/operator/EventWizard.jsx";
import UiAlert from "./components/common/UiAlert.jsx";
import ConfirmModal from "./components/common/ConfirmModal.jsx";
import LogoImg from "./assets/logo.png";

const EMPTY_REWARD = { codePrefix: "", title: "", value: "", description: "", wheelLabel: "", symbol: "star", active: true, applicableProducts: "", discountRate: "100" };
const EMPTY_BANNER = { title: "", imageUrl: "", linkUrl: "", active: true, order: 0 };
const EMPTY_CAMPAIGN = { code: "", name: "", startsAt: "", endsAt: "", timezone: "Asia/Ho_Chi_Minh", allowUnlisted: false, unlistedSpinQuota: 1 };

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await login(email, password);
      onLogin();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <img src={LogoImg} alt="Hồng Phúc Glass Logo" style={{ height: "48px", objectFit: "contain" }} />
        </div>
        <div className="eyebrow" style={{ textAlign: "center" }}>HỒNG PHÚC GLASS</div>
        <h1 style={{ textAlign: "center", fontSize: "22px" }}>Đăng nhập Quản trị</h1>
        <p style={{ textAlign: "center" }}>Cổng thông tin quản lý sự kiện tri ân khách hàng Hồng Phúc Glass.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Mật khẩu
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primary">Đăng nhập</button>
      </form>
    </main>
  );
}

function Shell({ tab, setTab, onLogout, children }) {
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#fff", display: "grid", placeItems: "center", padding: "4px" }}>
            <img src={LogoImg} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div>
            <strong>Hồng Phúc Glass</strong>
            <small>Hệ thống Quản trị</small>
          </div>
        </div>

        <nav>
          {[
            ["overview", "Tổng quan"],
            ["campaigns", "Sự kiện"],
            ["participants", "Khách sự kiện"],
            ["groups", "Nhóm khách"],
            ["banners", "Banner"],
            ["rewards", "Giải thưởng"],
            // ["customers", "Khách hàng"],
            ["awards", "Kho Voucher"],
            ["campaign", "Luật quay"],
            ["rules", "Thể lệ"],
            // ["settings", "Môi trường (Env)"],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={onLogout}>
          Đăng xuất
        </button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

const PAGE_HELP_DATA = {
  overview: {
    title: "Tổng quan Báo cáo Dashboard",
    content: (
      <div>
        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          Trang Tổng quan cung cấp bức tranh toàn cảnh về hiệu quả sự kiện và thống kê phát thưởng theo thời gian thực:
        </p>
        <ul style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.7", margin: "8px 0", paddingLeft: "20px" }}>
          <li><strong>Lượt quay đã dùng:</strong> Tổng số lượt quay khách hàng đã thực hiện trên Zalo Mini App.</li>
          <li><strong>Voucher trúng:</strong> Tổng số phần quà/voucher đã phát ra (gồm cả Voucher cấp sẵn & lượt quay trúng quà).</li>
          <li><strong>Voucher đã đổi:</strong> Số lượng voucher khách đã mang tới Showroom quy đổi thành công.</li>
          <li><strong>Trạng thái Hệ thống:</strong> Tình trạng kết nối Zalo OA, đồng bộ dữ liệu Realtime về Google Sheets.</li>
        </ul>
      </div>
    ),
  },
  campaigns: {
    title: "Quản lý Sự kiện (Campaigns)",
    content: (
      <div>
        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          Sự kiện là chương trình Vòng quay may mắn tổng thể. Bạn có thể tạo nhiều sự kiện nhưng <strong>chỉ có ĐÚNG 1 SỰ KIỆN KÍCH HOẠT (Active)</strong> chạy công khai trên Mini App tại một thời điểm:
        </p>
        <ul style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.7", margin: "8px 0", paddingLeft: "20px" }}>
          <li><code>Draft</code>: Sự kiện nháp, đang chuẩn bị cấu hình.</li>
          <li><code>Active</code>: Sự kiện duy nhất đang công khai cho khách quay trên Zalo Mini App.</li>
          <li><code>Paused</code>: Tạm ngưng sự kiện.</li>
          <li><code>Ended / Archived</code>: Đã kết thúc và lưu trữ lịch sử.</li>
        </ul>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px", borderRadius: "8px", fontSize: "12px", color: "#166534", marginTop: "8px" }}>
          <strong>Nhân bản (Clone):</strong> Cho phép copy nhanh danh mục quà & luật quay từ sự kiện cũ sang sự kiện mới.
        </div>
      </div>
    ),
  },
  participants: {
    title: "Khách sự kiện & Quy tắc Ưu tiên Phát quà",
    content: (
      <div>
        <div style={{ background: "#fff7ed", border: "1.5px solid #fdba74", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
          <strong style={{ color: "#c2410c", fontSize: "13px", display: "block", marginBottom: "6px" }}>
            QUY TẮC & THỨ TỰ ƯU TIÊN PHÁT QUÀ (RẤT QUAN TRỌNG):
          </strong>
          <ol style={{ fontSize: "12px", color: "#431407", lineHeight: "1.7", margin: 0, paddingLeft: "18px" }}>
            <li>
              <strong>CẤP 1 — VOUCHER CẤP SẴN:</strong> Nếu khách được cấp sẵn Voucher (qua Import Excel hoặc Thêm/Sửa thủ công), hệ thống <strong>ƯU TIÊN TRẢ NGAY VOUCHER ĐÓ (100% TRÚNG)</strong> cho đến khi hết Voucher cấp sẵn. Lượt này <em>không tính xác suất ngẫu nhiên</em>.
            </li>
            <li>
              <strong>CẤP 2 — LUẬT QUAY (SPIN RULES):</strong> Khi quay hết Voucher cấp sẵn, các lượt sau sẽ tự động chạy theo <strong>% Xác suất trúng & Hạn mức</strong> cấu hình ở <em>Luật quay</em>.
            </li>
          </ol>
        </div>
        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          <strong>Tính năng chính:</strong>
        </p>
        <ul style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.7", margin: "4px 0", paddingLeft: "20px" }}>
          <li><strong>+ Thêm thủ công:</strong> Nhập tên, SĐT, chọn Nhóm và tích chọn trực tiếp các Voucher cấp sẵn.</li>
          <li><strong>Import Excel:</strong> Kiểm tra trùng SĐT toàn hệ thống, hiển thị Modal so sánh tên và cho chọn <code>🛡️ Bỏ qua</code> hoặc <code>➕ Cộng dồn</code> cho từng khách.</li>
          <li><strong>+ Quà / Xóa quà:</strong> Cấp bổ sung hoặc xóa bớt Voucher trùng lỡ import nhiều lần.</li>
        </ul>
      </div>
    ),
  },
  groups: {
    title: "Nhóm khách hàng (Customer Groups)",
    content: (
      <div>
        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          Nhóm khách hàng giúp phân loại đối tượng tham gia sự kiện (Ví dụ: Khách Đại lý VIP, Khách mua hàng Showroom, Khách Vãng lai):
        </p>
        <ul style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.7", margin: "8px 0", paddingLeft: "20px" }}>
          <li><strong>Phân nhóm linh hoạt:</strong> 1 Khách hàng có thể thuộc một hoặc nhiều Nhóm.</li>
          <li><strong>Gắn Luật quay đặc thù:</strong> Mỗi nhóm có thể được áp dụng một <em>Luật quay riêng</em> (Ví dụ: Khách VIP có tỷ lệ trúng Voucher giá trị cao hơn).</li>
        </ul>
      </div>
    ),
  },
  banners: {
    title: "Quản lý Banner truyền thông",
    content: (
      <div>
        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          Quản lý các hình ảnh Banner truyền thông hiển thị slider ở đầu trang chủ Zalo Mini App:
        </p>
        <ul style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.7", margin: "8px 0", paddingLeft: "20px" }}>
          <li><strong>Tải file ảnh:</strong> Tải trực tiếp file ảnh từ máy tính (tối đa 8MB) hoặc dán đường dẫn URL.</li>
          <li><strong>Link liên kết:</strong> Dán link đường dẫn để khi khách bấm vào Banner sẽ chuyển tiếp tới trang sản phẩm / website.</li>
        </ul>
      </div>
    ),
  },
  rewards: {
    title: "Quản lý Giải thưởng (Reward Catalog)",
    content: (
      <div>
        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          Khai báo cơ cấu danh mục phần quà trong chương trình Vòng quay may mắn (`reward_catalog`):
        </p>
        <ul style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.7", margin: "8px 0", paddingLeft: "20px" }}>
          <li><strong>Tên quà & Mệnh giá:</strong> Tên hiển thị trên vòng quay & Giá trị niêm yết (VNĐ).</li>
          <li><strong>Mã tiền tố (Code Prefix):</strong> Mã sinh tiền tố khi khách trúng quà (Ví dụ: <code>VOUCHER_10M</code>).</li>
          <li><strong>Sản phẩm áp dụng:</strong> Khai báo dòng sản phẩm được áp dụng voucher (Ví dụ: <em>Kính cường lực Hồng Phúc</em>).</li>
        </ul>
      </div>
    ),
  },
  awards: {
    title: "Kho Voucher & Vận hành Awards",
    content: (
      <div>
        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          Quản lý kho Voucher thực tế và theo dõi vòng đời sử dụng quà của khách hàng:
        </p>
        <ul style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.7", margin: "8px 0", paddingLeft: "20px" }}>
          <li><code>Issued</code>: Voucher đã cấp/phát thành công cho khách.</li>
          <li><code>Delivered</code>: Đã gửi thông báo thành công qua ZNS / Zalo.</li>
          <li><code>Redeemed</code>: Khách đã đưa mã Voucher tới showroom quy đổi thành công.</li>
          <li><strong>Thao tác:</strong> Đổi trạng thái sang Redeemed, Hủy mã, hoặc Gửi lại tin nhắn ZNS.</li>
        </ul>
      </div>
    ),
  },
  rules: {
    title: "Cấu hình Luật quay (Spin Rules)",
    content: (
      <div>
        <div style={{ background: "#fff7ed", border: "1.5px solid #fdba74", padding: "10px", borderRadius: "8px", marginBottom: "10px", fontSize: "12px", color: "#431407" }}>
          ⚡ <strong>Lưu ý:</strong> Luật quay % xác suất chỉ áp dụng sau khi khách <strong>đã quay hết tất cả Voucher cấp sẵn</strong> (hoặc khách không có Voucher cấp sẵn).
        </div>
        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          Cấu hình tỷ lệ % xác suất trúng và các hạn mức kiểm soát rủi ro ngân sách:
        </p>
        <ul style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.7", margin: "8px 0", paddingLeft: "20px" }}>
          <li><strong>Tỷ lệ % Xác suất (`win_rate`):</strong> Phần trăm cơ hội trúng quà của từng giải thưởng.</li>
          <li><strong>Hạn mức Ngày (`daily_limit`):</strong> Số lượng quà phát ra tối đa trong 1 ngày.</li>
          <li><strong>Hạn mức Tổng (`total_limit`):</strong> Tổng số quà phát ra trong suốt chiến dịch.</li>
        </ul>
      </div>
    ),
  },
  settings: {
    title: "Cấu hình Môi trường (System & Env)",
    content: (
      <div>
        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          Quản lý cấu hình biến môi trường kết nối hệ thống Backend, Zalo Mini App và dịch vụ bên thứ ba:
        </p>
        <ul style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.7", margin: "8px 0", paddingLeft: "20px" }}>
          <li><strong>Môi trường:</strong> Chuyển đổi giữa <code>development</code> (local test) và <code>production</code>.</li>
          <li><strong>Zalo App & OA & ZNS:</strong> Khai báo App Secret, Official Account ID và Mẫu tin ZNS gửi quà.</li>
          <li><strong>Google Sheets Webhook:</strong> Dán Webhook URL để tự động ghi log dữ liệu realtime về Google Sheets.</li>
        </ul>
      </div>
    ),
  },
};

function Header({ title, subtitle, helpTopic }) {
  const [showHelpModal, setShowHelpModal] = useState(false);
  const helpInfo = helpTopic ? PAGE_HELP_DATA[helpTopic] : null;

  return (
    <header className="page-header" style={{ position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow">HỒNG PHÚC GLASS · HỆ THỐNG QUẢN TRỊ</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
            <h1 style={{ margin: 0 }}>{title}</h1>
            {helpInfo && (
              <button
                type="button"
                className="help-icon-btn"
                title="Bấm để xem hướng dẫn sử dụng cho trang này"
                style={{
                  background: "#ea580c",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  fontSize: "14px",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "inline-grid",
                  placeItems: "center",
                  boxShadow: "0 2px 6px rgba(234, 88, 12, 0.4)",
                  transition: "transform 0.15s ease",
                  flexShrink: 0,
                }}
                onClick={() => setShowHelpModal(true)}
              >
                ?
              </button>
            )}
          </div>
          <p>{subtitle}</p>
        </div>
      </div>

      {/* PAGE SPECIFIC HELP MODAL */}
      {showHelpModal && helpInfo && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px", maxHeight: "85vh", overflowY: "auto" }}
          >
            <div className="modal-header" style={{ background: "#fff7ed", borderBottom: "1px solid #fdba74" }}>
              <h3 className="modal-title" style={{ color: "#c2410c", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>❓ Hướng dẫn sử dụng:</span>
                <span>{helpInfo.title}</span>
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowHelpModal(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ padding: "20px", display: "grid", gap: "14px" }}>
              {helpInfo.content}
            </div>
            <div className="modal-footer" style={{ background: "#f8fafc", padding: "12px 20px" }}>
              <button type="button" className="primary" onClick={() => setShowHelpModal(false)}>
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Overview() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/admin/campaigns")
      .then((r) => {
        setCampaigns(r.items || []);
        if (r.items?.[0]) setSelectedCampaignId(r.items[0].id);
      })
      .catch((e) => setError(e.message));
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
      <Header helpTopic="overview" title="Tổng quan Báo cáo (Dashboard)" subtitle="Theo dõi chỉ số hiệu quả sự kiện và thống kê phát thưởng real-time." />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-heading">
          <h2>Chọn sự kiện báo cáo:</h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} style={{ padding: "8px 12px" }}>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) — {c.status}
                </option>
              ))}
            </select>
            <button className="primary" onClick={exportCsv}>
              Xuất Báo cáo CSV
            </button>
          </div>
        </div>
        <div className="stats" style={{ marginTop: "16px" }}>
          <div className="stat">
            <span>Thành viên sự kiện</span>
            <strong>{m.totalParticipants ?? "—"}</strong>
          </div>
          <div className="stat">
            <span>Lượt quay đã cấp</span>
            <strong>{m.totalAllocatedSpins ?? "—"}</strong>
          </div>
          <div className="stat">
            <span>Lượt đã sử dụng</span>
            <strong>{m.totalSpinsUsed ?? "—"}</strong>
          </div>
          <div className="stat">
            <span>Voucher trúng</span>
            <strong>{m.awardsTotal ?? "—"}</strong>
          </div>
          <div className="stat">
            <span>Voucher đã đổi</span>
            <strong>{m.awardsRedeemed ?? "—"}</strong>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>Trạng thái Vận hành Hệ thống</h2>
        <div className="status-overview-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginTop: "12px" }}>
          <div style={{ padding: "16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>SỰ KIỆN KHÁCH HÀNG</span>
            <strong style={{ display: "block", fontSize: "16px", color: "#1e293b", marginTop: "4px" }}>Hồng Phúc Glass</strong>
          </div>
          <div style={{ padding: "16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>BÁO CÁO REALTIME</span>
            <strong style={{ display: "block", fontSize: "16px", color: "#166534", marginTop: "4px" }}>Tự động đồng bộ</strong>
          </div>
          <div style={{ padding: "16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>BẢO MẬT DỮ LIỆU</span>
            <strong style={{ display: "block", fontSize: "16px", color: "#1e293b", marginTop: "4px" }}>Xác minh Zalo OA</strong>
          </div>
        </div>
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

  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    id: null,
    name: "",
    newStatus: "",
    title: "",
    message: "",
    variant: "primary",
    confirmText: "Xác nhận",
  });

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

  const promptStatusChange = (campaign, newStatus) => {
    let title = "Xác nhận chuyển trạng thái";
    let message = "";
    let variant = "primary";
    let confirmText = "Xác nhận";

    if (newStatus === "active") {
      title = "🚀 Xác nhận Kích hoạt sự kiện";
      message = `Bạn có chắc chắn muốn KÍCH HOẠT sự kiện '${campaign.name}'?\nLưu ý: Nếu có sự kiện khác đang diễn ra, hệ thống sẽ báo lỗi và yêu cầu bạn tạm dừng sự kiện đó trước.`;
      variant = "primary";
      confirmText = "Kích hoạt sự kiện";
    } else if (newStatus === "paused") {
      title = "⏸️ Xác nhận Tạm dừng sự kiện";
      message = `Bạn có chắc chắn muốn TẠM DỪNG sự kiện '${campaign.name}'?\nLưu ý: Khách hàng sẽ tạm thời không thể tham gia quay thưởng trong thời gian tạm dừng.`;
      variant = "warning";
      confirmText = "Tạm dừng sự kiện";
    } else if (newStatus === "ended") {
      title = "🛑 Xác nhận Kết thúc sự kiện";
      message = `Bạn có chắc chắn muốn KẾT THÚC sự kiện '${campaign.name}'?\nLưu ý: Thao tác này sẽ chính thức đóng cổng quay thưởng.`;
      variant = "danger";
      confirmText = "Kết thúc sự kiện";
    } else if (newStatus === "archived") {
      title = "📦 Xác nhận Lưu trữ sự kiện";
      message = `Bạn có chắc chắn muốn LƯU TRỮ sự kiện '${campaign.name}'?`;
      variant = "danger";
      confirmText = "Lưu trữ sự kiện";
    }

    setStatusModal({
      isOpen: true,
      id: campaign.id,
      name: campaign.name,
      newStatus,
      title,
      message,
      variant,
      confirmText,
    });
  };

  const handleExecuteStatusChange = async () => {
    if (!statusModal.id || !statusModal.newStatus) return;
    setError("");
    try {
      await api(`/admin/campaigns/${statusModal.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: statusModal.newStatus }),
      });
      setStatusModal({ isOpen: false, id: null, name: "", newStatus: "", title: "", message: "", variant: "primary", confirmText: "" });
      await load();
    } catch (e) {
      setError(e.message);
      setStatusModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <>
      <Header helpTopic="campaigns" title="Quản lý Sự kiện (Campaigns)" subtitle="Tạo mới, nhân bản, thiết lập và chuyển đổi trạng thái vòng đời của từng sự kiện quay thưởng." />
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

          {/* UNLISTED CUSTOMER POLICY CONTROLS */}
          <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", marginTop: "10px", display: "grid", gap: "8px" }}>
            <label className="check" style={{ fontWeight: "700", color: "#1e293b", cursor: "pointer", margin: 0 }}>
              <input
                type="checkbox"
                checked={form.allowUnlisted ?? false}
                onChange={(e) => setForm({ ...form, allowUnlisted: e.target.checked })}
              />
              Cho phép Khách hàng ngoài danh sách (Khách vãng lai) tham gia quay
            </label>

            {form.allowUnlisted && (
              <label style={{ fontSize: "12px", color: "#475569", margin: 0 }}>
                Số lượt quay cấp mặc định cho khách vãng lai:
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.unlistedSpinQuota ?? 1}
                  onChange={(e) => setForm({ ...form, unlistedSpinQuota: Number(e.target.value) })}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
            )}
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
                  <small style={{ color: item.allowUnlisted ? "#0369a1" : "#64748b", fontWeight: "600" }}>
                    {item.allowUnlisted ? `Khách ngoài danh sách: Cho phép quay (${item.unlistedSpinQuota || 1} lượt)` : "🔒 Khách ngoài danh sách: Không cho phép"}
                  </small>
                  {(item.startsAt || item.endsAt) && (
                    <small>Thời gian: {item.startsAt ? new Date(item.startsAt).toLocaleString("vi-VN") : "Bắt đầu mở"} → {item.endsAt ? new Date(item.endsAt).toLocaleString("vi-VN") : "Không giới hạn"}</small>
                  )}
                </div>
                <div className="actions" style={{ flexWrap: "wrap" }}>
                  <button onClick={() => { setCloning(item); setCloneForm({ code: `${item.code}_COPY`, name: `${item.name} (Copy)`, cloneMode: "config_only" }); }}>Nhân bản</button>
                  {item.status !== "archived" && (
                    <button onClick={() => { setEditing(item.id); setForm(item); }}>Sửa</button>
                  )}
                  {item.status === "draft" && (
                    <>
                      <button className="primary" onClick={() => promptStatusChange(item, "active")}>Kích hoạt</button>
                      <button className="danger" onClick={() => promptStatusChange(item, "archived")}>Lưu trữ</button>
                    </>
                  )}
                  {item.status === "active" && (
                    <>
                      <button onClick={() => promptStatusChange(item, "paused")}>Tạm dừng</button>
                      <button className="danger" onClick={() => promptStatusChange(item, "ended")}>Kết thúc</button>
                    </>
                  )}
                  {item.status === "paused" && (
                    <>
                      <button className="primary" onClick={() => promptStatusChange(item, "active")}>Kích hoạt lại</button>
                      <button className="danger" onClick={() => promptStatusChange(item, "ended")}>Kết thúc</button>
                      <button onClick={() => promptStatusChange(item, "archived")}>Lưu trữ</button>
                    </>
                  )}
                  {item.status === "ended" && (
                    <>
                      <button className="primary" onClick={() => promptStatusChange(item, "active")}>Gia hạn & Kích hoạt lại</button>
                      <button onClick={() => promptStatusChange(item, "draft")}>Đưa về Nháp</button>
                      <button className="danger" onClick={() => promptStatusChange(item, "archived")}>Lưu trữ</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={statusModal.isOpen}
        title={statusModal.title}
        message={statusModal.message}
        variant={statusModal.variant}
        confirmText={statusModal.confirmText}
        cancelText="Hủy bỏ"
        onConfirm={handleExecuteStatusChange}
        onCancel={() => setStatusModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}

function formatGroupedRewards(plannedRewards) {
  if (!plannedRewards || !plannedRewards.length) return [];
  const map = new Map();
  for (const rw of plannedRewards) {
    const title = String(rw.title || "").trim();
    const value = Number(rw.value || 0);
    const desc = String(rw.description || rw.applicable_products || rw.applicableProducts || "").trim();
    const key = `${title}|||${value}|||${desc}`;

    if (!map.has(key)) {
      map.set(key, { title, value, description: desc, count: 1 });
    } else {
      map.get(key).count += 1;
    }
  }
  return Array.from(map.values());
}

function CampaignParticipants() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [participants, setParticipants] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState("voucher");
  const [importRowsJson, setImportRowsJson] = useState("");
  const [importResult, setImportResult] = useState(null);

  const [duplicateResolverModal, setDuplicateResolverModal] = useState({
    isOpen: false,
    totalRows: 0,
    newCount: 0,
    duplicateCount: 0,
    duplicateRows: [],
    newRows: [],
    saving: false,
  });

  const [checking, setChecking] = useState(false);
  const [rowActions, setRowActions] = useState({});

  const [manualAddModal, setManualAddModal] = useState({
    isOpen: false,
    name: "",
    phone: "",
    groupId: "",
    note: "",
    spinQuota: 1,
    status: "active",
    selectedRewardIds: [],
    saving: false,
  });

  const [editParticipantModal, setEditParticipantModal] = useState({
    isOpen: false,
    customerId: "",
    name: "",
    phone: "",
    groupId: "",
    note: "",
    spinQuota: 1,
    status: "active",
    selectedRewardIds: [],
    saving: false,
  });

  const [manualAwardModal, setManualAwardModal] = useState({
    isOpen: false,
    customerId: "",
    customerName: "",
    rewardId: "",
    voucherCode: "",
    reason: "Cấp bổ sung từ Admin",
    saving: false,
  });

  useEffect(() => {
    api("/admin/campaigns").then((r) => {
      setCampaigns(r.items || []);
      if (r.items?.[0]) setSelectedCampaignId(r.items[0].id);
    }).catch((e) => setError(e.message));

    api("/admin/rewards").then((r) => {
      setRewards(r.items || []);
    }).catch(() => { });

    api("/admin/groups").then((r) => {
      setCustomerGroups(r.items || []);
    }).catch(() => { });
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

  const executeFinalImport = async (actionsToUse = rowActions) => {
    if (!selectedCampaignId) return;
    setDuplicateResolverModal((prev) => ({ ...prev, saving: true }));
    setError("");
    try {
      let rows = JSON.parse(importRowsJson);
      const result = await api(`/admin/campaigns/${selectedCampaignId}/participants/import`, {
        method: "POST",
        body: JSON.stringify({ rows, importMode, rowActions: actionsToUse }),
      });

      setImportResult(result);
      setDuplicateResolverModal({ isOpen: false, totalRows: 0, newCount: 0, duplicateCount: 0, duplicateRows: [], newRows: [], saving: false });
      if (result.importedCount > 0 || result.accumulatedCount > 0) {
        await load();
      }
    } catch (err) {
      setError(`Lỗi Import: ${err.message}`);
      setDuplicateResolverModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    const isWorkbook = /\.(xlsx|xls)$/i.test(file.name);
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result || "";
        let jsonStr = "";
        if (file.name.toLowerCase().endsWith(".json")) {
          jsonStr = typeof content === "string" ? content : "";
        } else {
          const rows = isWorkbook ? parseWorkbookToRows(content) : parseCsvToRows(content);
          jsonStr = JSON.stringify(rows, null, 2);
        }
        setImportRowsJson(jsonStr);
        setError("");
      } catch (error) {
        setError(`Không đọc được file ${file.name}: ${error.message}`);
      }
    };
    if (isWorkbook) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, "UTF-8");
  };

  const handleSetRowAction = (phone, action) => {
    setRowActions((prev) => ({ ...prev, [phone]: action }));
  };

  const handleSetAllActions = (action) => {
    if (!duplicateResolverModal.duplicateRows) return;
    const updated = {};
    for (const dup of duplicateResolverModal.duplicateRows) {
      updated[dup.normalizedPhone] = action;
    }
    setRowActions(updated);
  };

  const handleImportSubmit = async (e) => {
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

      setChecking(true);
      const checkRes = await api(`/admin/campaigns/${selectedCampaignId}/participants/check-import`, {
        method: "POST",
        body: JSON.stringify({ rows, importMode }),
      });
      setChecking(false);

      if (checkRes.errors?.length > 0) {
        setError(`Không thể import: ${checkRes.errors.join("; ")}`);
        return;
      }

      if (checkRes.duplicateCount > 0) {
        const initialActions = {};
        for (const dup of checkRes.duplicateRows) {
          initialActions[dup.normalizedPhone] = dup.action || "skip";
        }
        setRowActions(initialActions);
        setDuplicateResolverModal({
          isOpen: true,
          totalRows: checkRes.totalRows,
          newCount: checkRes.newCount,
          duplicateCount: checkRes.duplicateCount,
          duplicateRows: checkRes.duplicateRows,
          newRows: checkRes.newRows,
          saving: false,
        });
      } else {
        await executeFinalImport({});
      }
    } catch (err) {
      setChecking(false);
      setError(err.message);
    }
  };

  const toggleRewardSelection = (rewardId) => {
    setManualAddModal((prev) => {
      const exists = prev.selectedRewardIds.includes(rewardId);
      const updated = exists
        ? prev.selectedRewardIds.filter((id) => id !== rewardId)
        : [...prev.selectedRewardIds, rewardId];
      const updatedQuota = Math.max(prev.spinQuota, updated.length);
      return { ...prev, selectedRewardIds: updated, spinQuota: updatedQuota };
    });
  };

  const handleSaveManualParticipant = async (e) => {
    e.preventDefault();
    if (!selectedCampaignId || !manualAddModal.name.trim() || !manualAddModal.phone.trim()) return;
    setManualAddModal((prev) => ({ ...prev, saving: true }));
    setError("");
    try {
      await api(`/admin/campaigns/${selectedCampaignId}/participants/manual`, {
        method: "POST",
        body: JSON.stringify({
          name: manualAddModal.name.trim(),
          phone: manualAddModal.phone.trim(),
          groupId: manualAddModal.groupId || null,
          note: manualAddModal.note.trim(),
          spinQuota: Number(manualAddModal.spinQuota || 1),
          status: manualAddModal.status,
          selectedRewardIds: manualAddModal.selectedRewardIds || [],
        }),
      });
      setManualAddModal({
        isOpen: false,
        name: "",
        phone: "",
        groupId: "",
        note: "",
        spinQuota: 1,
        status: "active",
        selectedRewardIds: [],
        saving: false,
      });
      await load();
    } catch (err) {
      setError(`Lỗi thêm khách hàng: ${err.message}`);
      setManualAddModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const toggleEditRewardSelection = (rewardId) => {
    setEditParticipantModal((prev) => {
      const currentList = prev.selectedRewardIds || [];
      const exists = currentList.includes(rewardId);
      const updated = exists
        ? currentList.filter((id) => id !== rewardId)
        : [...currentList, rewardId];
      const updatedQuota = Math.max(prev.spinQuota, updated.length);
      return { ...prev, selectedRewardIds: updated, spinQuota: updatedQuota };
    });
  };

  const handleSaveEditParticipant = async (e) => {
    e.preventDefault();
    if (!selectedCampaignId || !editParticipantModal.customerId) return;
    setEditParticipantModal((prev) => ({ ...prev, saving: true }));
    setError("");
    try {
      await api(`/admin/campaigns/${selectedCampaignId}/participants/${editParticipantModal.customerId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editParticipantModal.name.trim(),
          groupId: editParticipantModal.groupId || null,
          note: editParticipantModal.note.trim(),
          spinQuota: Number(editParticipantModal.spinQuota || 0),
          status: editParticipantModal.status,
          selectedRewardIds: editParticipantModal.selectedRewardIds || [],
        }),
      });
      setEditParticipantModal({
        isOpen: false,
        customerId: "",
        name: "",
        phone: "",
        groupId: "",
        note: "",
        spinQuota: 1,
        status: "active",
        selectedRewardIds: [],
        saving: false,
      });
      await load();
    } catch (err) {
      setError(`Lỗi cập nhật: ${err.message}`);
      setEditParticipantModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleDeleteParticipant = async (item) => {
    if (!confirm(`Xóa khách hàng ${item.customerName} (${item.customerPhone}) khỏi sự kiện này?`)) return;
    setError("");
    try {
      await api(`/admin/campaigns/${selectedCampaignId}/participants/${item.customerId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(`Lỗi xóa khách hàng: ${err.message}`);
    }
  };

  const handleClearParticipantRewards = async (item) => {
    if (!confirm(`Xóa tất cả Voucher cấp sẵn của khách hàng ${item.customerName} (${item.customerPhone})? Sau khi xóa, bạn có thể cấp lại chính xác 1 lần.`)) return;
    setError("");
    try {
      await api(`/admin/campaigns/${selectedCampaignId}/participants/${item.customerId}/rewards`, { method: "DELETE" });
      await load();
      alert("Đã làm sạch danh sách Voucher cấp sẵn thành công!");
    } catch (err) {
      setError(`Lỗi xóa voucher: ${err.message}`);
    }
  };

  const handleExecuteManualAward = async (e) => {
    e.preventDefault();
    if (!manualAwardModal.customerId || !manualAwardModal.rewardId) return;
    setManualAwardModal((prev) => ({ ...prev, saving: true }));
    setError("");
    try {
      await api(`/admin/campaigns/${selectedCampaignId}/participants/${manualAwardModal.customerId}/manual-awards`, {
        method: "POST",
        body: JSON.stringify({
          rewardId: manualAwardModal.rewardId,
          voucherCode: manualAwardModal.voucherCode,
          reason: manualAwardModal.reason,
        }),
      });
      setManualAwardModal({ isOpen: false, customerId: "", customerName: "", rewardId: "", voucherCode: "", reason: "Cấp bổ sung từ Admin", saving: false });
      await load();
      alert("Đã cấp phần quà / voucher thành công cho khách hàng!");
    } catch (err) {
      setError(`Lỗi cấp quà: ${err.message}`);
      setManualAwardModal((prev) => ({ ...prev, saving: false }));
    }
  };

  return (
    <>
      <Header helpTopic="participants" title="Khách hàng sự kiện" subtitle="Quản lý thành viên tham gia sự kiện (thêm thủ công, phân nhóm, cấp Voucher sẵn & import Excel)." />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-heading">
          <h2>Chọn sự kiện:</h2>
          <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} style={{ padding: "8px 12px" }}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code}) — {c.status}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="primary" onClick={() => setManualAddModal({ isOpen: true, name: "", phone: "", groupId: "", note: "", spinQuota: 1, status: "active", selectedRewardIds: [], saving: false })}>
              + Thêm thủ công Khách hàng
            </button>
            <button onClick={() => setImporting(!importing)}>
              {importing ? "Đóng Import" : "Nhập danh sách Excel / CSV"}
            </button>
          </div>
        </div>

        {importing && (
          <div className="panel inline-form" style={{ border: "2px solid #ef7e3a", marginTop: "16px" }}>
            <h2>Nhập danh sách Khách hàng từ Excel / CSV</h2>
            <p style={{ fontSize: "13px", color: "#666" }}>Tải lên file Excel CSV (.csv) chứa các cột: <code>Tên KH</code>, <code>SĐT</code>, <code>Số voucher tặng</code>, <code>Ghi chú</code>.</p>
            <form onSubmit={handleImportSubmit} style={{ display: "grid", gap: "12px" }}>
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
                  <option value="quota">Cấp Lượt quay Khách sự kiện (Không yêu cầu mệnh giá ở Ghi chú)</option>
                  <option value="voucher">Cấp Voucher quà sẵn từ cột Ghi chú (VD: '5 triệu, 3 triệu')</option>
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
              <button className="primary" disabled={checking}>
                {checking ? "🔍 Đang kiểm tra trùng SĐT..." : "Tiến hành Import dữ liệu"}
              </button>
            </form>

            {importResult && (
              <div style={{ marginTop: "12px", padding: "12px", background: importResult.success ? "#e6f4ea" : "#fff1f1", borderRadius: "8px" }}>
                <div><strong>Kết quả Import:</strong> Đã xử lý {importResult.totalRows} dòng:</div>
                <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "13px" }}>
                  <li>✅ Thêm mới: <strong>{importResult.importedCount}</strong> khách hàng.</li>
                  {importResult.duplicateCount > 0 && (
                    <li style={{ color: "#d97706", fontWeight: "bold" }}>
                      ⚠️ Phát hiện {importResult.duplicateCount} SĐT trùng trong sự kiện:
                      {importResult.skippedCount > 0 && ` (Đã BỎ QUA ${importResult.skippedCount} khách)`}
                      {importResult.accumulatedCount > 0 && ` (Đã CỘNG DỒN thêm quà cho ${importResult.accumulatedCount} khách)`}
                    </li>
                  )}
                </ul>
                {importResult.infoMessages?.length > 0 && (
                  <div style={{ marginTop: "8px", maxHeight: "120px", overflowY: "auto", background: "#fff", padding: "8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #cbd5e1" }}>
                    {importResult.infoMessages.map((msg, i) => (
                      <div key={i} style={{ padding: "2px 0", color: "#475569" }}>{msg}</div>
                    ))}
                  </div>
                )}
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
                <th>Nhóm KH</th>
                <th>Ghi chú</th>
                <th>Tổng lượt cấp</th>
                <th>Lượt còn lại</th>
                <th>Voucher cấp sẵn</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" style={{ textAlign: "center", padding: "24px" }}>Đang tải...</td></tr>
              ) : participants.length === 0 ? (
                <tr><td colSpan="10" style={{ textAlign: "center", padding: "24px" }}>Sự kiện chưa có khách hàng nào. Bấm "+ Thêm thủ công Khách hàng" hoặc "Nhập danh sách Excel" để thêm.</td></tr>
              ) : (
                participants.map((item) => {
                  const remSpins = item.remainingSpins ?? item.spinQuota ?? 0;
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.customerName}</strong></td>
                      <td>{item.customerPhone || item.customerId}</td>
                      <td>
                        {item.assignedGroups?.length > 0 ? (
                          item.assignedGroups.map((g, i) => (
                            <span key={i} style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", marginRight: "4px", display: "inline-block" }}>
                              {g}
                            </span>
                          ))
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{item.note || "—"}</td>
                      <td><span style={{ fontWeight: "600", color: "#475569" }}>{item.spinQuota} lượt</span></td>
                      <td>
                        <span
                          style={{
                            fontWeight: "700",
                            color: remSpins > 0 ? "#16a34a" : "#dc2626",
                            background: remSpins > 0 ? "#f0fdf4" : "#fef2f2",
                            border: remSpins > 0 ? "1px solid #bbf7d0" : "1px solid #fecaca",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            display: "inline-block",
                          }}
                        >
                          {remSpins} lượt
                        </span>
                      </td>
                    <td>
                      {item.plannedRewards?.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          {formatGroupedRewards(item.plannedRewards).map((rw, i) => (
                            <span
                              key={i}
                              title={rw.description ? `Sản phẩm áp dụng: ${rw.description}` : undefined}
                              style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}
                            >
                              <span>
                                {rw.title} ({rw.value.toLocaleString("vi-VN")}đ)
                                {rw.description && <span style={{ opacity: 0.75, fontSize: "10px", marginLeft: "4px" }}>• {rw.description}</span>}
                              </span>
                              {rw.count > 1 && (
                                <strong style={{ background: "#d97706", color: "#fff", padding: "1px 6px", borderRadius: "10px", fontSize: "10px", fontWeight: "800" }}>
                                  x{rw.count}
                                </strong>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td><span className={`badge status-${item.status}`}>{item.status === "active" ? "Đang bật" : item.status === "paused" ? "Tạm dừng" : item.status}</span></td>
                    <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        <button
                          type="button"
                          className="primary"
                          style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "6px" }}
                          onClick={() =>
                            setManualAwardModal({
                              isOpen: true,
                              customerId: item.customerId,
                              customerName: item.customerName,
                              rewardId: rewards[0]?.id || "",
                              voucherCode: "",
                              reason: "Cấp bổ sung từ Admin",
                              saving: false,
                            })
                          }
                        >
                          + Quà
                        </button>
                        {item.plannedRewards?.length > 0 && (
                          <button
                            type="button"
                            style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "6px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                            title="Xóa bớt Voucher trùng do lỡ Import 2 lần"
                            onClick={() => handleClearParticipantRewards(item)}
                          >
                            🧹 Xóa quà
                          </button>
                        )}
                        <button
                          type="button"
                          style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "6px" }}
                          onClick={() => {
                            const currentRewardIds = [];
                            for (const rw of item.plannedRewards || []) {
                              const match = rewards.find((r) => r.id === rw.reward_id || (r.title === rw.title && Number(r.value || 0) === Number(rw.value || 0)));
                              if (match?.id && !currentRewardIds.includes(match.id)) {
                                currentRewardIds.push(match.id);
                              }
                            }
                            setEditParticipantModal({
                              isOpen: true,
                              customerId: item.customerId,
                              name: item.customerName,
                              phone: item.customerPhone,
                              groupId: item.groupId || "",
                              note: item.note || "",
                              spinQuota: item.spinQuota,
                              status: item.status,
                              selectedRewardIds: currentRewardIds,
                              saving: false,
                            });
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="danger"
                          style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "6px" }}
                          onClick={() => handleDeleteParticipant(item)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MANUAL ADD PARTICIPANT MODAL */}
      {manualAddModal.isOpen && (
        <div className="modal-overlay" onClick={() => setManualAddModal((prev) => ({ ...prev, isOpen: false }))}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "540px", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div className="modal-header">
              <h3 className="modal-title">👤 Thêm thủ công Khách hàng vào sự kiện</h3>
              <button type="button" className="modal-close-btn" onClick={() => setManualAddModal((prev) => ({ ...prev, isOpen: false }))}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveManualParticipant} style={{ display: "grid", gap: "12px", padding: "16px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Tên Khách hàng *
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn A"
                    value={manualAddModal.name}
                    onChange={(e) => setManualAddModal({ ...manualAddModal, name: e.target.value })}
                    required
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>

                <label>
                  Số điện thoại *
                  <input
                    type="text"
                    placeholder="VD: 0912345678"
                    value={manualAddModal.phone}
                    onChange={(e) => setManualAddModal({ ...manualAddModal, phone: e.target.value })}
                    required
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Nhóm Khách hàng (Từ Bảng customer_groups)
                  <select
                    value={manualAddModal.groupId}
                    onChange={(e) => setManualAddModal({ ...manualAddModal, groupId: e.target.value })}
                    style={{ width: "100%", marginTop: "4px", padding: "8px" }}
                  >
                    <option value="">-- Không xếp nhóm --</option>
                    {customerGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Số lượt quay cấp *
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={manualAddModal.spinQuota}
                    onChange={(e) => setManualAddModal({ ...manualAddModal, spinQuota: Number(e.target.value) })}
                    required
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
              </div>

              <label>
                Ghi chú bổ sung
                <input
                  type="text"
                  placeholder="VD: Cấp lượt đợt 1, Khách hàng dự phòng..."
                  value={manualAddModal.note}
                  onChange={(e) => setManualAddModal({ ...manualAddModal, note: e.target.value })}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              {/* HARDCODED VOUCHER SELECTION (MULTI-SELECT) */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "12px", background: "#f8fafc" }}>
                <label style={{ fontWeight: "700", display: "block", marginBottom: "6px", color: "#0f172a", fontSize: "13px" }}>
                  🎁 Cấp sẵn Voucher (Chọn một hoặc nhiều Voucher cố định):
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "140px", overflowY: "auto", paddingRight: "4px" }}>
                  {rewards.length === 0 ? (
                    <span style={{ fontSize: "12px", color: "#64748b" }}>Chưa có phần quà nào trong Tab Giải thưởng.</span>
                  ) : (
                    rewards.map((r) => {
                      const isSelected = manualAddModal.selectedRewardIds.includes(r.id);
                      const prod = r.applicableProducts || r.applicable_products;
                      const code = r.codePrefix || r.code_prefix || "VOUCHER";
                      const valText = Number(r.value || 0).toLocaleString("vi-VN") + "đ";

                      return (
                        <label
                          key={r.id}
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: "10px",
                            fontSize: "12px",
                            cursor: "pointer",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: isSelected ? "1.5px solid #ea580c" : "1px solid #cbd5e1",
                            background: isSelected ? "#fff7ed" : "#ffffff",
                            boxShadow: isSelected ? "0 2px 4px rgba(234, 88, 12, 0.1)" : "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRewardSelection(r.id)}
                            style={{
                              display: "inline-block",
                              width: "18px",
                              height: "18px",
                              margin: "0",
                              cursor: "pointer",
                              accentColor: "#ea580c",
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: isSelected ? "800" : "600", color: isSelected ? "#9a3412" : "#1e293b", fontSize: "12px" }}>
                                {r.title}
                              </span>
                              <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>
                                {valText}
                              </span>
                              <span style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", padding: "1px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                                Mã: {code}
                              </span>
                            </div>
                            {prod && (
                              <span style={{ color: "#64748b", fontSize: "11px" }}>
                                🏷️ SP áp dụng: <strong>{prod}</strong>
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <small style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "block" }}>
                  * Nếu chọn Voucher cấp sẵn, lượt quay sự kiện sẽ tự động tương ứng với số Voucher cấp.
                </small>
              </div>

              <label>
                Trạng thái
                <select
                  value={manualAddModal.status}
                  onChange={(e) => setManualAddModal({ ...manualAddModal, status: e.target.value })}
                  style={{ width: "100%", marginTop: "4px", padding: "8px" }}
                >
                  <option value="active">Đang bật (Active)</option>
                  <option value="paused">Tạm dừng (Paused)</option>
                </select>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", position: "sticky", bottom: 0, background: "#fff", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                <button type="button" onClick={() => setManualAddModal((prev) => ({ ...prev, isOpen: false }))} disabled={manualAddModal.saving}>
                  Hủy
                </button>
                <button type="submit" className="primary" disabled={manualAddModal.saving}>
                  {manualAddModal.saving ? "Đang lưu…" : "Thêm khách hàng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PARTICIPANT MODAL */}
      {editParticipantModal.isOpen && (
        <div className="modal-overlay" onClick={() => setEditParticipantModal((prev) => ({ ...prev, isOpen: false }))}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "540px", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div className="modal-header">
              <h3 className="modal-title">✏️ Sửa thông tin Khách hàng sự kiện</h3>
              <button type="button" className="modal-close-btn" onClick={() => setEditParticipantModal((prev) => ({ ...prev, isOpen: false }))}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditParticipant} style={{ display: "grid", gap: "12px", padding: "16px", overflowY: "auto", flex: 1 }}>
              <label>
                Tên Khách hàng *
                <input
                  type="text"
                  value={editParticipantModal.name}
                  onChange={(e) => setEditParticipantModal({ ...editParticipantModal, name: e.target.value })}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                Số điện thoại (Mã định danh)
                <input
                  type="text"
                  value={editParticipantModal.phone}
                  disabled
                  style={{ width: "100%", marginTop: "4px", background: "#f1f5f9" }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Nhóm Khách hàng (Từ Bảng customer_groups)
                  <select
                    value={editParticipantModal.groupId}
                    onChange={(e) => setEditParticipantModal({ ...editParticipantModal, groupId: e.target.value })}
                    style={{ width: "100%", marginTop: "4px", padding: "8px" }}
                  >
                    <option value="">-- Không xếp nhóm --</option>
                    {customerGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Số lượt quay cấp *
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editParticipantModal.spinQuota}
                    onChange={(e) => setEditParticipantModal({ ...editParticipantModal, spinQuota: Number(e.target.value) })}
                    required
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
              </div>

              <label>
                Ghi chú
                <input
                  type="text"
                  value={editParticipantModal.note}
                  onChange={(e) => setEditParticipantModal({ ...editParticipantModal, note: e.target.value })}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              {/* HARDCODED VOUCHER SELECTION IN EDIT MODAL */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "12px", background: "#f8fafc" }}>
                <label style={{ fontWeight: "700", display: "block", marginBottom: "6px", color: "#0f172a", fontSize: "13px" }}>
                  🎁 Cấp sẵn Voucher (Chọn một hoặc nhiều Voucher cố định):
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "140px", overflowY: "auto", paddingRight: "4px" }}>
                  {rewards.length === 0 ? (
                    <span style={{ fontSize: "12px", color: "#64748b" }}>Chưa có phần quà nào trong Tab Giải thưởng.</span>
                  ) : (
                    rewards.map((r) => {
                      const isSelected = (editParticipantModal.selectedRewardIds || []).includes(r.id);
                      const prod = r.applicableProducts || r.applicable_products;
                      const code = r.codePrefix || r.code_prefix || "VOUCHER";
                      const valText = Number(r.value || 0).toLocaleString("vi-VN") + "đ";

                      return (
                        <label
                          key={r.id}
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: "10px",
                            fontSize: "12px",
                            cursor: "pointer",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: isSelected ? "1.5px solid #ea580c" : "1px solid #cbd5e1",
                            background: isSelected ? "#fff7ed" : "#ffffff",
                            boxShadow: isSelected ? "0 2px 4px rgba(234, 88, 12, 0.1)" : "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEditRewardSelection(r.id)}
                            style={{
                              display: "inline-block",
                              width: "18px",
                              height: "18px",
                              margin: "0",
                              cursor: "pointer",
                              accentColor: "#ea580c",
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: isSelected ? "800" : "600", color: isSelected ? "#9a3412" : "#1e293b", fontSize: "12px" }}>
                                {r.title}
                              </span>
                              <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>
                                {valText}
                              </span>
                              <span style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", padding: "1px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                                Mã: {code}
                              </span>
                            </div>
                            {prod && (
                              <span style={{ color: "#64748b", fontSize: "11px" }}>
                                🏷️ SP áp dụng: <strong>{prod}</strong>
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <small style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "block" }}>
                  * Nếu chọn Voucher cấp sẵn, lượt quay sự kiện sẽ tự động tương ứng với số Voucher cấp.
                </small>
              </div>

              <label>
                Trạng thái
                <select
                  value={editParticipantModal.status}
                  onChange={(e) => setEditParticipantModal({ ...editParticipantModal, status: e.target.value })}
                  style={{ width: "100%", marginTop: "4px", padding: "8px" }}
                >
                  <option value="active">Đang bật (Active)</option>
                  <option value="paused">Tạm dừng (Paused)</option>
                </select>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", position: "sticky", bottom: 0, background: "#fff", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                <button type="button" onClick={() => setEditParticipantModal((prev) => ({ ...prev, isOpen: false }))} disabled={editParticipantModal.saving}>
                  Hủy
                </button>
                <button type="submit" className="primary" disabled={editParticipantModal.saving}>
                  {editParticipantModal.saving ? "Đang lưu…" : "Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL AWARD GRANT MODAL */}
      {manualAwardModal.isOpen && (
        <div className="modal-overlay" onClick={() => setManualAwardModal((prev) => ({ ...prev, isOpen: false }))}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <h3 className="modal-title"> Cấp phần quà bổ sung cho {manualAwardModal.customerName}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setManualAwardModal((prev) => ({ ...prev, isOpen: false }))}>
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteManualAward} style={{ display: "grid", gap: "12px", padding: "16px" }}>
              <label>
                Chọn Giải thưởng *
                <select
                  value={manualAwardModal.rewardId}
                  onChange={(e) => setManualAwardModal({ ...manualAwardModal, rewardId: e.target.value })}
                  required
                  style={{ width: "100%", marginTop: "4px", padding: "8px" }}
                >
                  {rewards.map((r) => {
                    const prod = r.applicableProducts || r.applicable_products;
                    const prodText = prod ? ` · SP: ${prod}` : "";
                    const codeText = r.codePrefix || r.code_prefix ? ` [Mã: ${r.codePrefix || r.code_prefix}]` : "";
                    return (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.value ? Number(r.value).toLocaleString("vi-VN") + "đ" : ""}){codeText}{prodText}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                Mã Voucher (Tùy chọn - để trống để hệ thống tự tạo)
                <input
                  type="text"
                  placeholder="VD: VOUCHER_100K_ABC"
                  value={manualAwardModal.voucherCode}
                  onChange={(e) => setManualAwardModal({ ...manualAwardModal, voucherCode: e.target.value })}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                Ghi chú / Lý do cấp *
                <input
                  type="text"
                  placeholder="VD: Cấp bổ sung từ Admin"
                  value={manualAwardModal.reason}
                  onChange={(e) => setManualAwardModal({ ...manualAwardModal, reason: e.target.value })}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button type="button" onClick={() => setManualAwardModal((prev) => ({ ...prev, isOpen: false }))} disabled={manualAwardModal.saving}>
                  Hủy
                </button>
                <button type="submit" className="primary" disabled={manualAwardModal.saving}>
                  {manualAwardModal.saving ? "Đang cấp…" : "Xác nhận Cấp quà"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW & DUPLICATE RESOLVER MODAL POPUP */}
      {duplicateResolverModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDuplicateResolverModal((prev) => ({ ...prev, isOpen: false }))}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "860px", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: duplicateResolverModal.duplicateCount > 0 ? "#d97706" : "#0f172a" }}>
                {duplicateResolverModal.duplicateCount > 0
                  ? `⚠️ Phát hiện ${duplicateResolverModal.duplicateCount} Khách hàng bị trùng SĐT`
                  : `📋 Xem trước & Xác nhận Nhập ${duplicateResolverModal.totalRows} Khách hàng`}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDuplicateResolverModal((prev) => ({ ...prev, isOpen: false }))}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: "grid", gap: "16px", padding: "20px 24px" }}>
              {/* SUMMARY BADGE */}
              {duplicateResolverModal.duplicateCount > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fffbe8", padding: "12px 16px", borderRadius: "10px", border: "1px solid #ffe58f", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "13px", color: "#78350f", fontWeight: "600" }}>
                      <strong>{duplicateResolverModal.newCount}</strong> khách mới sẽ được thêm. Vui lòng chọn xử lý cho <strong>{duplicateResolverModal.duplicateCount}</strong> khách trùng bên dưới:
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      style={{ background: "#e2e8f0", color: "#334155", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", border: "0", cursor: "pointer" }}
                      onClick={() => handleSetAllActions("skip")}
                    >
                      🛡️ Bỏ qua tất cả trùng
                    </button>
                    <button
                      type="button"
                      style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}
                      onClick={() => handleSetAllActions("accumulate")}
                    >
                      ➕ Cộng dồn tất cả quà
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ background: "#f0fdf4", padding: "12px 16px", borderRadius: "10px", border: "1px solid #bbf7d0", color: "#166534", fontSize: "13px", fontWeight: "600" }}>
                  ✅ Tất cả <strong>{duplicateResolverModal.totalRows}</strong> khách hàng trong file đều hợp lệ và không bị trùng SĐT. Đã sẵn sàng Import!
                </div>
              )}

              {/* DUPLICATE ROWS TABLE */}
              {duplicateResolverModal.duplicateCount > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "#d97706", fontWeight: "800" }}>
                    ⚠️ Danh sách khách hàng bị trùng SĐT ({duplicateResolverModal.duplicateCount} khách):
                  </h4>
                  <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", maxHeight: "40vh" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#fffbe8", borderBottom: "1px solid #ffe58f", position: "sticky", top: 0, zIndex: 1 }}>
                          <th style={{ padding: "8px 10px", width: "45px" }}>Dòng</th>
                          <th style={{ padding: "8px 10px" }}>Tên trong Excel</th>
                          <th style={{ padding: "8px 10px" }}>Tên đã có ở Hệ thống</th>
                          <th style={{ padding: "8px 10px" }}>SĐT</th>
                          <th style={{ padding: "8px 10px" }}>Quà trong file</th>
                          <th style={{ padding: "8px 10px" }}>Trạng thái & Quà hiện có</th>
                          <th style={{ padding: "8px 10px", textAlign: "center", width: "190px" }}>Tùy chọn xử lý</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicateResolverModal.duplicateRows.map((dup) => {
                          const currentAction = rowActions[dup.normalizedPhone] || dup.action || "skip";
                          return (
                            <tr key={dup.rowNumber} style={{ borderBottom: "1px solid #f1f5f9", background: currentAction === "accumulate" ? "#fff7ed" : "#fff" }}>
                              <td style={{ padding: "8px 10px", fontWeight: "bold", color: "#64748b" }}>#{dup.rowNumber}</td>
                              <td style={{ padding: "8px 10px" }}><strong>{dup.name}</strong></td>
                              <td style={{ padding: "8px 10px" }}>
                                {dup.isDifferentName ? (
                                  <div>
                                    <strong style={{ color: "#b45309" }}>{dup.existingName}</strong>
                                    <span style={{ display: "block", fontSize: "10px", color: "#dc2626", fontWeight: "bold" }}>
                                      ⚠️ Khác tên trong Excel!
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: "#475569" }}>{dup.existingName}</span>
                                )}
                              </td>
                              <td style={{ padding: "8px 10px" }}><code>{dup.phone}</code></td>
                              <td style={{ padding: "8px 10px" }}>
                                <span style={{ color: "#d97706", fontWeight: "700" }}>
                                  {dup.note || `${dup.voucherCount} voucher`}
                                </span>
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                {dup.inCampaign ? (
                                  dup.existingRewards?.length > 0 ? (
                                    <span style={{ color: "#0369a1", fontSize: "11px", fontWeight: "600" }}>
                                      {dup.existingRewards.join(", ")}
                                    </span>
                                  ) : (
                                    <span style={{ color: "#64748b" }}>{dup.existingSpinQuota} lượt quay</span>
                                  )
                                ) : (
                                  <span style={{ color: "#65a30d", fontWeight: "bold", fontSize: "11px" }}>
                                    🌐 Đã có ở hệ thống (Chưa vào SK này)
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "8px 10px", textAlign: "center" }}>
                                <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "2px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                                  <button
                                    type="button"
                                    style={{
                                      padding: "4px 8px",
                                      fontSize: "11px",
                                      fontWeight: "800",
                                      borderRadius: "4px",
                                      border: "0",
                                      background: currentAction === "skip" ? "#0f172a" : "transparent",
                                      color: currentAction === "skip" ? "#fff" : "#64748b",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => handleSetRowAction(dup.normalizedPhone, "skip")}
                                  >
                                    🛡️ Bỏ qua
                                  </button>
                                  <button
                                    type="button"
                                    style={{
                                      padding: "4px 8px",
                                      fontSize: "11px",
                                      fontWeight: "800",
                                      borderRadius: "4px",
                                      border: "0",
                                      background: currentAction === "accumulate" ? "#ea580c" : "transparent",
                                      color: currentAction === "accumulate" ? "#fff" : "#64748b",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => handleSetRowAction(dup.normalizedPhone, "accumulate")}
                                  >
                                    ➕ Cộng dồn
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* NEW ROWS PREVIEW TABLE */}
              {duplicateResolverModal.newRows?.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "#166534", fontWeight: "800" }}>
                    ✅ Danh sách khách hàng mới sẽ thêm ({duplicateResolverModal.newRows.length} khách):
                  </h4>
                  <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", maxHeight: "30vh" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", position: "sticky", top: 0, zIndex: 1 }}>
                          <th style={{ padding: "8px 10px", width: "45px" }}>Dòng</th>
                          <th style={{ padding: "8px 10px" }}>Tên Khách hàng</th>
                          <th style={{ padding: "8px 10px" }}>Số điện thoại</th>
                          <th style={{ padding: "8px 10px" }}>Quà / Lượt quay cấp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicateResolverModal.newRows.map((nr) => (
                          <tr key={nr.rowNumber} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 10px", fontWeight: "bold", color: "#64748b" }}>#{nr.rowNumber}</td>
                            <td style={{ padding: "8px 10px" }}><strong>{nr.name}</strong></td>
                            <td style={{ padding: "8px 10px" }}><code>{nr.phone}</code></td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ color: "#166534", fontWeight: "600" }}>
                                {nr.note || `${nr.voucherCount} lượt quay`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setDuplicateResolverModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={duplicateResolverModal.saving}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => executeFinalImport(rowActions)}
                disabled={duplicateResolverModal.saving}
              >
                {duplicateResolverModal.saving ? "Đang import..." : "Xác nhận & Tiến hành Import"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  return <><Header helpTopic="banners" title="Quản lý banner" subtitle="Quản lý hình ảnh banner truyền thông hiển thị trên trang chủ Mini App." />{error && <div className="error">{error}</div>}<div className="split"><form className="panel form" onSubmit={save}><h2>{editing ? "Sửa banner" : "Thêm banner"}</h2><label>Tiêu đề<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>URL ảnh<input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value, imageData: undefined })} placeholder="https://..." /></label><label>Hoặc tải file<input type="file" accept="image/*" onChange={upload} /></label>{(form.imageUrl || form.imageData) && <img className="banner-preview" src={form.imageData || form.imageUrl} />}<label>Link khi bấm<input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} /></label><label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Hiển thị</label><div className="actions"><button className="primary" disabled={saving}>{saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm banner"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY_BANNER); }}>Hủy</button>}</div></form><section className="panel"><h2>Danh sách ({items.length})</h2><div className="items">{items.map((item) => <article className="item" key={item.id}><img src={item.imageUrl} /><div><strong>{item.title}</strong><small>{item.active ? "Đang hiển thị" : "Đang tắt"}</small><div className="actions"><button onClick={() => { setEditing(item.id); setForm(item); }}>Sửa</button><button className="danger" onClick={() => remove(item.id)}>Xóa</button></div></div></article>)}</div></section></div></>;
}

function Rewards() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_REWARD);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  // Extract unique applicable product names dynamically from database rewards
  const productOptions = useMemo(() => {
    const set = new Set();
    (items || []).forEach((item) => {
      if (item.applicableProducts && item.applicableProducts.trim()) {
        set.add(item.applicableProducts.trim());
      }
    });
    return Array.from(set);
  }, [items]);

  const load = async () => {
    try {
      const result = await api("/admin/rewards");
      setItems(result.items || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const body = { ...form, value: Number(form.value) };
      await api(editing ? `/admin/rewards/${editing}` : "/admin/rewards", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });

      setForm(EMPTY_REWARD);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm("Xóa giải thưởng này?")) return;
    try {
      await api(`/admin/rewards/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <Header
        helpTopic="rewards"
        title="Giải thưởng & Tồn kho"
        subtitle="Quản lý danh mục giải thưởng, mệnh giá và cấu hình mẫu ZNS gửi khách hàng."
      />
      {error && <div className="error">{error}</div>}
      <div className="split">
        <form className="panel form" onSubmit={save}>
          <h2>{editing ? "Sửa quà" : "Thêm quà"}</h2>
          <label>
            Tên giải thưởng
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label>
            Mã quà
            <input
              value={form.codePrefix}
              onChange={(e) => setForm({ ...form, codePrefix: e.target.value })}
              required
            />
          </label>
          <div className="two">
            <label>
              Giá trị
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                required
              />
            </label>
          </div>

          <label>
            Sản phẩm áp dụng
            <input
              list="applicable-products-datalist"
              value={form.applicableProducts || ""}
              onChange={(e) => setForm({ ...form, applicableProducts: e.target.value })}
              placeholder="VD: Kính cường lực Hồng Phúc..."
            />
            <datalist id="applicable-products-datalist">
              {productOptions.map((prod, idx) => (
                <option key={idx} value={prod} />
              ))}
            </datalist>
          </label>

          <label>
            Tỉ lệ khấu trừ tối đa / đơn hàng
            <input
              value={form.discountRate || ""}
              onChange={(e) => setForm({ ...form, discountRate: e.target.value })}
              placeholder="VD: 50"
            />
          </label>

          <label>
            Mô tả bổ sung
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />{" "}
            Hiển thị trên vòng quay
          </label>

          <div className="actions">
            <button className="primary">{editing ? "Lưu thay đổi" : "Thêm quà"}</button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY_REWARD);
                }}
              >
                Hủy
              </button>
            )}
          </div>
        </form>

        <section className="panel">
          <h2>Danh mục ({items.length})</h2>
          <div className="items">
            {items.map((item) => (
              <article className="item reward-item" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.value.toLocaleString("vi-VN")}đ · Mã: {item.codePrefix} · {item.active ? "Đang bật" : "Đang tắt"}
                  </small>
                  <small style={{ color: "#0369a1", fontWeight: "600", marginTop: "2px", display: "block" }}>
                    Sản phẩm: {item.applicableProducts || ""} | Khấu trừ max: {item.discountRate || "100"}%
                  </small>
                </div>
                <div className="actions">
                  <button
                    onClick={() => {
                      setEditing(item.id);
                      setForm(item);
                    }}
                  >
                    Sửa
                  </button>
                  <button className="danger" onClick={() => remove(item.id)}>
                    Xóa
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Customers() {
  const [items, setItems] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", totalSpins: 5, selectedRewardId: "" });
  const [editingId, setEditingId] = useState(null);

  const [manualAwardModal, setManualAwardModal] = useState({
    isOpen: false,
    customerId: "",
    customerName: "",
    campaignId: "",
    rewardId: "",
    voucherCode: "",
    reason: "Cấp bổ sung từ Admin",
    saving: false,
  });

  useEffect(() => {
    api("/admin/campaigns").then((r) => {
      const available = r.items || [];
      setCampaigns(available);
      if (available[0]) {
        setManualAwardModal((prev) => ({ ...prev, campaignId: available[0].id }));
      }
    }).catch(() => { });

    api("/admin/rewards").then((r) => {
      setRewards(r.items || []);
    }).catch(() => { });
  }, []);

  const load = () =>
    api(`/admin/customers?search=${encodeURIComponent(search)}`)
      .then((r) => setItems(r.items || []))
      .catch((e) => setError(e.message));

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMsg("");
    try {
      const rewardObj = rewards.find((r) => r.id === form.selectedRewardId);
      const payloadRewards = rewardObj
        ? [{ code: rewardObj.codePrefix || rewardObj.id, title: rewardObj.title, value: rewardObj.value, description: rewardObj.description }]
        : [];

      if (editingId) {
        await api(`/admin/customers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ ...form, totalSpins: Number(form.totalSpins), rewards: payloadRewards }),
        });
        setSuccessMsg("Đã cập nhật thông tin khách hàng & voucher thành công!");
      } else {
        await api("/admin/customers", {
          method: "POST",
          body: JSON.stringify({ ...form, totalSpins: Number(form.totalSpins), rewards: payloadRewards }),
        });
        setSuccessMsg("Đã thêm khách hàng & voucher thành công!");
      }
      setForm({ name: "", phone: "", totalSpins: 5, selectedRewardId: "" });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    const existingRewardId = item.rewards?.[0]?.code || "";
    const matched = rewards.find((r) => r.codePrefix === existingRewardId || r.id === existingRewardId || r.title === item.rewards?.[0]?.title);
    setForm({
      name: item.name || "",
      phone: item.phone || "",
      totalSpins: item.totalSpins ?? 5,
      selectedRewardId: matched?.id || "",
    });
  };

  const remove = async (id) => {
    if (!confirm("Ẩn khách hàng này?")) return;
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/customers/${id}`, { method: "DELETE" });
      setSuccessMsg("Đã ẩn khách hàng thành công!");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleExecuteManualAward = async (e) => {
    e.preventDefault();
    if (!manualAwardModal.customerId || !manualAwardModal.campaignId || !manualAwardModal.rewardId) return;
    setManualAwardModal((prev) => ({ ...prev, saving: true }));
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/campaigns/${manualAwardModal.campaignId}/participants/${manualAwardModal.customerId}/manual-awards`, {
        method: "POST",
        body: JSON.stringify({
          rewardId: manualAwardModal.rewardId,
          voucherCode: manualAwardModal.voucherCode,
          reason: manualAwardModal.reason,
        }),
      });
      setManualAwardModal((prev) => ({ ...prev, isOpen: false, saving: false }));
      setSuccessMsg(`Đã cấp phần quà thành công cho khách hàng ${manualAwardModal.customerName}!`);
      await load();
    } catch (err) {
      setError(`Lỗi cấp quà: ${err.message}`);
      setManualAwardModal((prev) => ({ ...prev, saving: false }));
    }
  };

  return (
    <>
      <Header title="Khách hàng" subtitle="Thêm, chỉnh sửa thông tin khách hàng thủ công và kiểm tra số lượt quay / cấp voucher quà tặng." />
      {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}
      {successMsg && <UiAlert type="success" onClose={() => setSuccessMsg("")}>{successMsg}</UiAlert>}
      <section className="panel inline-form">
        <h2>{editingId ? "Sửa thông tin khách hàng" : "Thêm khách hàng mới"}</h2>
        <form onSubmit={save}>
          <input
            placeholder="Họ tên"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="Số điện thoại"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
          <input
            type="number"
            min="0"
            placeholder="Lượt quay"
            value={form.totalSpins}
            onChange={(e) => setForm({ ...form, totalSpins: e.target.value })}
          />

          <button className="primary">{editingId ? "Cập nhật" : "Thêm"}</button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", phone: "", totalSpins: 5, selectedRewardId: "" });
              }}
            >
              Hủy
            </button>
          )}
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Danh sách ({items.length})</h2>
          <input
            placeholder="🔍 Tìm tên hoặc số điện thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 12px", width: "260px" }}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên khách hàng</th>
                <th>Số điện thoại</th>
                <th>Tổng lượt cấp</th>
                <th>Lượt còn lại</th>
                <th>Voucher quà tặng</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                    Chưa có dữ liệu khách hàng.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const remSpins = item.remainingSpins ?? item.totalSpins ?? 0;
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.phone}</td>
                      <td><span style={{ fontWeight: "600", color: "#475569" }}>{item.totalSpins} lượt</span></td>
                      <td>
                        <span
                          style={{
                            fontWeight: "700",
                            color: remSpins > 0 ? "#16a34a" : "#dc2626",
                            background: remSpins > 0 ? "#f0fdf4" : "#fef2f2",
                            border: remSpins > 0 ? "1px solid #bbf7d0" : "1px solid #fecaca",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            display: "inline-block",
                          }}
                        >
                          {remSpins} lượt
                        </span>
                      </td>
                      <td>
                        {item.rewards?.filter((r) => r.title || r.code).length > 0 ? (
                          <span style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", display: "inline-block" }}>
                            {item.rewards.map((r) => r.title || r.code).filter(Boolean).join(", ")}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          className="btn-action secondary"
                          style={{ padding: "4px 8px", fontSize: "11px", marginRight: "4px" }}
                          onClick={() => startEdit(item)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="primary"
                          style={{ padding: "4px 8px", fontSize: "11px", marginRight: "4px" }}
                          onClick={() =>
                            setManualAwardModal({
                              isOpen: true,
                              customerId: item.id,
                              customerName: item.name,
                              campaignId: campaigns[0]?.id || "",
                              rewardId: rewards[0]?.id || "",
                              voucherCode: "",
                              reason: "Cấp bổ sung từ Admin",
                              saving: false,
                            })
                          }
                        >
                          Cấp quà
                        </button>
                        <button className="danger" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => remove(item.id)}>
                          Ẩn
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
            <small style={{ color: "#64748b", fontSize: "13px" }}>
              Hiển thị <strong>{(currentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(currentPage * pageSize, items.length)}</strong> trong <strong>{items.length}</strong> khách hàng
            </small>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="secondary"
                disabled={currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                style={{ padding: "5px 12px", fontSize: "12px" }}
              >
                ◀ Trang trước
              </button>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#334155", padding: "0 6px" }}>
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                style={{ padding: "5px 12px", fontSize: "12px" }}
              >
                Trang sau ▶
              </button>
            </div>
          </div>
        )}
      </section>

      {/* MANUAL AWARD GRANT MODAL FOR CUSTOMERS */}
      {manualAwardModal.isOpen && (
        <div className="modal-overlay" onClick={() => setManualAwardModal((prev) => ({ ...prev, isOpen: false }))}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <h3 className="modal-title">Cấp phần quà / Voucher cho {manualAwardModal.customerName}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setManualAwardModal((prev) => ({ ...prev, isOpen: false }))}>
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteManualAward} style={{ display: "grid", gap: "12px", padding: "16px" }}>
              <label>
                Chọn Sự kiện áp dụng *
                <select
                  value={manualAwardModal.campaignId}
                  onChange={(e) => setManualAwardModal({ ...manualAwardModal, campaignId: e.target.value })}
                  required
                  style={{ width: "100%", marginTop: "4px", padding: "8px" }}
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Chọn Giải thưởng *
                <select
                  value={manualAwardModal.rewardId}
                  onChange={(e) => setManualAwardModal({ ...manualAwardModal, rewardId: e.target.value })}
                  required
                  style={{ width: "100%", marginTop: "4px", padding: "8px" }}
                >
                  {rewards.map((r) => {
                    const prod = r.applicableProducts || r.applicable_products;
                    const prodText = prod ? ` · SP: ${prod}` : "";
                    const codeText = r.codePrefix || r.code_prefix ? ` [Mã: ${r.codePrefix || r.code_prefix}]` : "";
                    return (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.value ? Number(r.value).toLocaleString("vi-VN") + "đ" : ""}){codeText}{prodText}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                Mã Voucher (Tùy chọn - để trống để hệ thống tự tạo)
                <input
                  type="text"
                  placeholder="VD: VOUCHER_100K_ABC"
                  value={manualAwardModal.voucherCode}
                  onChange={(e) => setManualAwardModal({ ...manualAwardModal, voucherCode: e.target.value })}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                Ghi chú / Lý do cấp *
                <input
                  type="text"
                  placeholder="VD: Cấp bổ sung từ Admin"
                  value={manualAwardModal.reason}
                  onChange={(e) => setManualAwardModal({ ...manualAwardModal, reason: e.target.value })}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button type="button" onClick={() => setManualAwardModal((prev) => ({ ...prev, isOpen: false }))} disabled={manualAwardModal.saving}>
                  Hủy
                </button>
                <button type="submit" className="primary" disabled={manualAwardModal.saving}>
                  {manualAwardModal.saving ? "Đang cấp…" : "Xác nhận Cấp quà"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Awards() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    awardId: null,
    actionType: "", // "redeem" | "resend" | "status"
    targetStatus: "",
    reason: "",
    variant: "primary",
    loading: false,
  });

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

  const openRedeemModal = (item) => {
    setError("");
    setConfirmConfig({
      isOpen: true,
      title: "Xác nhận Đổi thưởng Voucher",
      message: `Bạn có chắc chắn muốn xác nhận Đổi thưởng cho Voucher [${item.code}] của khách hàng ${item.customerName || ""}?`,
      awardId: item.id,
      actionType: "redeem",
      targetStatus: "",
      reason: "",
      variant: "primary",
      loading: false,
    });
  };

  const openResendModal = (item) => {
    setError("");
    setConfirmConfig({
      isOpen: true,
      title: "Gửi lại tin nhắn ZNS",
      message: `Bạn có chắc chắn muốn gửi lại tin nhắn thông báo Voucher [${item.code}] qua Zalo (ZNS) cho khách hàng ${item.customerName || ""}?`,
      awardId: item.id,
      actionType: "resend",
      targetStatus: "",
      reason: "",
      variant: "primary",
      loading: false,
    });
  };

  const openStatusModal = (item, targetStatus) => {
    setError("");
    setConfirmConfig({
      isOpen: true,
      title: `Xác nhận Chuyển trạng thái sang ${targetStatus.toUpperCase()}`,
      message: `Vui lòng nhập lý do vận hành khi chuyển Voucher [${item.code}] sang trạng thái ${targetStatus.toUpperCase()}:`,
      awardId: item.id,
      actionType: "status",
      targetStatus,
      reason: "",
      variant: "danger",
      loading: false,
    });
  };

  const handleConfirmAction = async () => {
    const { awardId, actionType, targetStatus, reason } = confirmConfig;
    if (actionType === "status" && (!reason || !reason.trim())) {
      setError("Vui lòng nhập lý do vận hành hợp lệ.");
      return;
    }

    setConfirmConfig((prev) => ({ ...prev, loading: true }));
    setError("");
    setSuccessMsg("");
    try {
      if (actionType === "redeem") {
        await api(`/admin/awards/${awardId}/redeem`, { method: "POST" });
        setSuccessMsg("Đã xác nhận đổi thưởng cho Voucher thành công!");
      } else if (actionType === "resend") {
        await api(`/admin/awards/${awardId}/resend`, { method: "POST" });
        setSuccessMsg("Đã gửi lại tin nhắn ZNS thành công!");
      } else if (actionType === "status") {
        await api(`/admin/awards/${awardId}/status`, {
          method: "POST",
          body: JSON.stringify({ status: targetStatus, reason: reason.trim() }),
        });
        setSuccessMsg(`Đã cập nhật trạng thái Voucher sang ${targetStatus.toUpperCase()} thành công!`);
      }
      setConfirmConfig({ isOpen: false, title: "", message: "", awardId: null, actionType: "", targetStatus: "", reason: "", variant: "primary", loading: false });
      await load();
    } catch (e) {
      setError(e.message);
      setConfirmConfig((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <>
      <Header helpTopic="awards" title="Kho Voucher & Vận hành Awards" subtitle="Tra cứu, đổi thưởng, gửi lại ZNS và hủy/chuyển hết hạn voucher của khách hàng." />
      {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}
      {successMsg && <UiAlert type="success" onClose={() => setSuccessMsg("")}>{successMsg}</UiAlert>}
      <section className="panel mt-4">
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
        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", tableLayout: "auto", minWidth: "900px" }}>
            <thead>
              <tr>
                <th style={{ width: "180px" }}>Mã Voucher</th>
                <th style={{ width: "150px" }}>Tên Khách hàng</th>
                <th style={{ width: "120px" }}>Số điện thoại</th>
                <th style={{ width: "160px" }}>Phần thưởng</th>
                <th style={{ width: "110px" }}>Giá trị</th>
                <th style={{ width: "110px" }}>Trạng thái</th>
                <th style={{ width: "140px" }}>Ngày cấp</th>
                <th style={{ width: "180px" }}>Vận hành</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: "center", padding: "24px" }}>Đang tải dữ liệu...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: "center", padding: "24px" }}>Không tìm thấy voucher nào.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#f1f5f9",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        maxWidth: "180px",
                        cursor: "pointer",
                      }}
                      title={`Bấm để sao chép: ${item.code}`}
                      onClick={() => {
                        if (navigator?.clipboard?.writeText) {
                          navigator.clipboard.writeText(item.code);
                          setSuccessMsg(`Đã sao chép mã voucher [${item.code}]!`);
                        }
                      }}
                    >
                      <code
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          color: "#0f172a",
                          fontFamily: "monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "inline-block",
                          maxWidth: "140px",
                        }}
                      >
                        {item.code}
                      </code>
                      <span style={{ fontSize: "11px", color: "#64748b", flexShrink: 0 }}>📋</span>
                    </div>
                  </td>
                  <td><strong>{item.customerName}</strong></td>
                  <td>{item.customerPhone || item.customerId}</td>
                  <td>{item.title}</td>
                  <td><strong>{item.value ? `${item.value.toLocaleString("vi-VN")}đ` : "—"}</strong></td>
                  <td><span className={`badge status-${item.status}`}>{item.status}</span></td>
                  <td><small>{item.issuedAt ? new Date(item.issuedAt).toLocaleString("vi-VN") : "—"}</small></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {item.status !== "redeemed" && (item.status === "issued" || item.status === "delivered") && (
                      <button className="primary" style={{ padding: "4px 8px", fontSize: "11px", marginRight: "4px" }} onClick={() => openRedeemModal(item)}>Đổi thưởng</button>
                    )}
                    {item.status !== "redeemed" && (
                      <button style={{ padding: "4px 8px", fontSize: "11px", marginRight: "4px" }} onClick={() => openResendModal(item)}>Gửi lại ZNS</button>
                    )}
                    {item.status !== "redeemed" && item.status !== "void" && item.status !== "expired" && (
                      <button className="danger" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => openStatusModal(item, "void")}>Hủy</button>
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

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
        loading={confirmConfig.loading}
        confirmText={confirmConfig.actionType === "status" ? "Xác nhận Chuyển" : confirmConfig.actionType === "redeem" ? "Xác nhận Đổi thưởng" : "Gửi lại ZNS"}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmConfig({ isOpen: false, title: "", message: "", awardId: null, actionType: "", targetStatus: "", reason: "", variant: "primary", loading: false })}
      >
        {confirmConfig.actionType === "status" && (
          <div className="form-group" style={{ marginTop: "12px" }}>
            <label className="form-label" style={{ fontWeight: "600", marginBottom: "6px", display: "block" }}>Lý do vận hành (Bắt buộc):</label>
            <textarea
              className="form-control"
              rows="3"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              placeholder="VD: Khách vi phạm quy chế hoặc voucher quá hạn..."
              value={confirmConfig.reason}
              onChange={(e) => setConfirmConfig((prev) => ({ ...prev, reason: e.target.value }))}
            />
          </div>
        )}
      </ConfirmModal>
    </>
  );
}

function Rules() {
  const [rules, setRules] = useState({ intro: "", eligibility: [], rewards: [], usageNotes: [] });
  const [rawTexts, setRawTexts] = useState({ eligibility: "", rewards: "", usageNotes: "" });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const load = async () => {
    try {
      const r = await api("/admin/rules");
      if (r.rules) {
        setRules((prev) => ({ ...prev, ...r.rules }));
        setRawTexts({
          eligibility: Array.isArray(r.rules.eligibility) ? r.rules.eligibility.join("\n") : (r.rules.eligibility || ""),
          rewards: Array.isArray(r.rules.rewards) ? r.rules.rewards.join("\n") : (r.rules.rewards || ""),
          usageNotes: Array.isArray(r.rules.usageNotes) ? r.rules.usageNotes.join("\n") : (r.rules.usageNotes || ""),
        });
      }
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMsg("");
    try {
      const payload = {
        ...rules,
        eligibility: rawTexts.eligibility.split("\n").map((x) => x.trim()).filter(Boolean),
        rewards: rawTexts.rewards.split("\n").map((x) => x.trim()).filter(Boolean),
        usageNotes: rawTexts.usageNotes.split("\n").map((x) => x.trim()).filter(Boolean),
      };
      await api("/admin/rules", { method: "PUT", body: JSON.stringify(payload) });
      setSuccessMsg("Đã lưu nội dung thể lệ chương trình thành công!");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <Header helpTopic="rules" title="Thể lệ chương trình" subtitle="Cấu hình điều khoản, điều kiện và cơ cấu giải thưởng hiển thị trên Mini App." />
      {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}
      {successMsg && <UiAlert type="success" onClose={() => setSuccessMsg("")}>{successMsg}</UiAlert>}
      <form className="panel form rules" onSubmit={save}>
        <label>
          Giới thiệu
          <textarea value={rules.intro} onChange={(e) => setRules({ ...rules, intro: e.target.value })} />
        </label>
        {[
          ["eligibility", "Điều kiện tham gia"],
          ["rewards", "Cơ cấu giải thưởng"],
          ["usageNotes", "Quy định sử dụng Voucher"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              rows="5"
              value={rawTexts[key] || ""}
              onChange={(e) => setRawTexts({ ...rawTexts, [key]: e.target.value })}
            />
          </label>
        ))}
        <button className="primary">Lưu thể lệ</button>
      </form>
    </>
  );
}

function CampaignRules() {
  const EMPTY = {
    name: "",
    code: "",
    scope: "default",
    priority: 100,
    winRate: 100,
    maxTotalWins: "",
    oaRequired: false,
    active: true,
  };

  const [items, setItems] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [form, setForm] = useState(EMPTY);

  // Multi-spin state
  const [spinMode, setSpinMode] = useState("all");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(5);
  const [customSpins, setCustomSpins] = useState([1, 2, 3, 4, 5]);

  // Multi-reward list state
  const [rewardItems, setRewardItems] = useState([
    { rewardId: "", probability: 100, quantity: 10 },
  ]);

  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: "" });

  const load = async () => {
    try {
      const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
      const [rules, catalog] = await Promise.all([
        api(`/admin/campaign-rules${query}`),
        api("/admin/rewards"),
      ]);
      setItems(rules.items || []);
      const rItems = catalog.items || [];
      setRewards(rItems);
      if (!rewardItems[0]?.rewardId && rItems[0]) {
        setRewardItems([{ rewardId: rItems[0].id, probability: 100, quantity: 10 }]);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    api("/admin/campaigns")
      .then((result) => {
        const available = result.items || [];
        setCampaigns(available);
        if (!campaignId && available[0]) setCampaignId(available[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    void load();
  }, [campaignId]);

  const getTargetSpins = () => {
    if (spinMode === "all") {
      const list = [];
      for (let i = 1; i <= 50; i++) list.push(i);
      return list;
    }
    if (spinMode === "range") {
      const start = Math.max(1, Math.min(rangeStart, rangeEnd));
      const end = Math.max(start, Math.max(rangeStart, rangeEnd));
      const list = [];
      for (let i = start; i <= end; i++) list.push(i);
      return list;
    }
    return customSpins.length > 0 ? [...customSpins].sort((a, b) => a - b) : [1];
  };

  const handleAddRewardRow = () => {
    setRewardItems((prev) => [...prev, { rewardId: rewards[0]?.id || "", probability: 100, quantity: 5 }]);
  };

  const handleRemoveRewardRow = (idx) => {
    if (rewardItems.length <= 1) return;
    setRewardItems((prev) => prev.filter((_, index) => index !== idx));
  };

  const handleUpdateRewardRow = (idx, field, val) => {
    setRewardItems((prev) =>
      prev.map((item, index) => (index === idx ? { ...item, [field]: val } : item))
    );
  };

  const toggleCustomSpin = (num) => {
    setCustomSpins((prev) =>
      prev.includes(num) ? prev.filter((s) => s !== num) : [...prev, num]
    );
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    const targetSpins = getTargetSpins();
    const validRewards = rewardItems.filter((rw) => rw.rewardId && Number(rw.quantity) > 0);

    if (validRewards.length === 0) {
      setError("Vui lòng chọn ít nhất 1 giải thưởng hợp lệ.");
      return;
    }

    try {
      const body = {
        campaignId,
        name: form.name,
        code: form.code ? form.code.trim() : undefined,
        scope: form.scope,
        priority: Number(form.priority ?? 100),
        maxTotalWins: form.maxTotalWins !== "" && form.maxTotalWins != null ? Number(form.maxTotalWins) : null,
        oaRequired: Boolean(form.oaRequired),
        active: form.active !== false,
        spins: targetSpins.map((spinNum) => ({
          spinNumber: spinNum,
          winRate: Number(form.winRate ?? 100),
          rewards: validRewards.map((rw) => ({
            rewardId: rw.rewardId,
            probability: Number(rw.probability ?? 100),
            quantity: Number(rw.quantity ?? 1),
            remainingQuantity: Number(rw.quantity ?? 1),
          })),
        })),
      };

      await api(editing ? `/admin/campaign-rules/${editing}` : "/admin/campaign-rules", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });

      setSuccessMsg(editing ? "Đã cập nhật luật quay thành công!" : "Đã tạo mới luật quay thành công!");
      setForm(EMPTY);
      setEditing(null);
      setSpinMode("all");
      setRewardItems([{ rewardId: rewards[0]?.id || "", probability: 100, quantity: 10 }]);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const edit = (item) => {
    setEditing(item.id);
    const existingSpins = (item.spins || []).map((s) => s.spinNumber ?? s.spin_number).filter(Boolean);
    if (existingSpins.length >= 10) {
      setSpinMode("all");
    } else {
      setSpinMode("custom");
      setCustomSpins(existingSpins.length > 0 ? existingSpins : [1]);
    }

    const firstSpin = item.spins?.[0] || {};
    const existingRewards = (firstSpin.rewards || []).map((rw) => ({
      rewardId: rw.rewardId || rw.reward_id || rewards[0]?.id || "",
      probability: rw.probability ?? 100,
      quantity: rw.quantity ?? 1,
    }));

    setForm({
      name: item.name,
      code: item.code || "",
      scope: item.scope,
      priority: item.priority ?? 100,
      maxTotalWins: item.max_total_wins ?? "",
      oaRequired: item.oa_required ?? item.oaRequired ?? false,
      active: item.active !== false,
      winRate: firstSpin.win_rate ?? firstSpin.winRate ?? 100,
    });

    setRewardItems(existingRewards.length > 0 ? existingRewards : [{ rewardId: rewards[0]?.id || "", probability: 100, quantity: 10 }]);
  };

  const confirmRemove = (id, name) => {
    setError("");
    setDeleteModal({ isOpen: true, id, name });
  };

  const handleExecuteRemove = async () => {
    const { id, name } = deleteModal;
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/campaign-rules/${id}`, { method: "DELETE" });
      setSuccessMsg(`Đã xóa luật quay '${name}' thành công!`);
      setDeleteModal({ isOpen: false, id: null, name: "" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <Header helpTopic="rules" title="Quản lý Luật quay nâng cao" subtitle="Cấu hình đa lượt quay, tỷ lệ trúng và cơ cấu đa giải thưởng theo sự kiện." />
      {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}
      {successMsg && <UiAlert type="success" onClose={() => setSuccessMsg("")}>{successMsg}</UiAlert>}
      <div className="split mt-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
        <form className="panel form" style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }} onSubmit={save}>
          <h2>{editing ? "Sửa Luật quay" : "Tạo Luật quay mới"}</h2>
          <label style={{ minWidth: 0 }}>
            Sự kiện áp dụng *
            <select
              style={{ width: "100%", maxWidth: "100%", textOverflow: "ellipsis", boxSizing: "border-box" }}
              value={campaignId}
              onChange={(e) => {
                setCampaignId(e.target.value);
                setEditing(null);
                setForm(EMPTY);
              }}
              required
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </label>

          <label style={{ minWidth: 0 }}>
            Tên mô tả luật quay *
            <input
              style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VD: Luật trúng 100% cho lượt quay 1-5"
              required
            />
          </label>

          <div className="two" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", minWidth: 0 }}>
            <label style={{ minWidth: 0 }}>
              Mã luật (Code)
              <input
                style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="VD: DEFAULT_2026"
              />
            </label>

            <label style={{ minWidth: 0 }}>
              Phạm vi áp dụng *
              <select style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="default">🌐 Tất cả khách hàng (Default)</option>
                <option value="guest">🆕 Khách hàng mới / Khách vãng lai (Guest)</option>
                <option value="group">🏷️ Nhóm khách hàng (Group)</option>
                <option value="user">👤 Khách hàng chỉ định (User)</option>
              </select>
            </label>
          </div>

          {/* MULTI-SPIN CONTROLS */}
          <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", minWidth: 0 }}>
            <label style={{ fontWeight: "700", marginBottom: "8px", display: "block" }}>Lượt quay áp dụng *</label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                <input type="radio" name="advSpinMode" checked={spinMode === "all"} onChange={() => setSpinMode("all")} />
                Tất cả
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                <input type="radio" name="advSpinMode" checked={spinMode === "range"} onChange={() => setSpinMode("range")} />
                Khoảng lượt
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                <input type="radio" name="advSpinMode" checked={spinMode === "custom"} onChange={() => setSpinMode("custom")} />
                Tích chọn lượt
              </label>
            </div>

            {spinMode === "range" && (
              <div className="two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label>Từ lượt: <input type="number" min="1" max="50" style={{ width: "100%" }} value={rangeStart} onChange={(e) => setRangeStart(Number(e.target.value))} /></label>
                <label>Đến lượt: <input type="number" min="1" max="50" style={{ width: "100%" }} value={rangeEnd} onChange={(e) => setRangeEnd(Number(e.target.value))} /></label>
              </div>
            )}

            {spinMode === "custom" && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((num) => (
                  <button
                    type="button"
                    key={num}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: customSpins.includes(num) ? "2px solid #e11b22" : "1px solid #cbd5e1",
                      background: customSpins.includes(num) ? "#fee2e2" : "#fff",
                      color: customSpins.includes(num) ? "#b91c1c" : "#475569",
                      fontWeight: "700",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                    onClick={() => toggleCustomSpin(num)}
                  >
                    Lượt {num}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="two" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", minWidth: 0 }}>
            <label style={{ minWidth: 0 }}>
              Tỷ lệ thắng lượt (%) *
              <input type="number" min="0" max="100" style={{ width: "100%" }} value={form.winRate} onChange={(e) => setForm({ ...form, winRate: Number(e.target.value) })} required />
            </label>

            <label style={{ minWidth: 0 }}>
              Độ ưu tiên (Priority)
              <input type="number" style={{ width: "100%" }} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            </label>
          </div>

          {/* MULTI-REWARD CONTROLS */}
          <div style={{ background: "#fff", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontWeight: "700", margin: 0 }}>Cơ cấu Giải thưởng trong luật *</label>
              <button type="button" className="btn-link" style={{ fontSize: "11px", fontWeight: "800", color: "#e11b22", background: "none", border: 0, cursor: "pointer" }} onClick={handleAddRewardRow}>
                + Thêm quà
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {rewardItems.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr auto", gap: "8px", alignItems: "flex-end", background: "#f8fafc", padding: "10px", borderRadius: "10px", border: "1px solid #f1f5f9", minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontSize: "11px", color: "#475569", fontWeight: "700", display: "block", marginBottom: "4px" }}>Tên Giải thưởng {idx + 1}</label>
                    <select style={{ width: "100%", padding: "6px 8px", fontSize: "11px", boxSizing: "border-box" }} value={item.rewardId || rewards[0]?.id || ""} onChange={(e) => handleUpdateRewardRow(idx, "rewardId", e.target.value)} required>
                      {rewards.map((r) => {
                        const prod = r.applicableProducts || r.applicable_products;
                        const prodText = prod ? ` · SP: ${prod}` : "";
                        const codeText = r.codePrefix || r.code_prefix ? ` [Mã: ${r.codePrefix || r.code_prefix}]` : "";
                        return (
                          <option key={r.id} value={r.id}>
                            {r.title} ({r.value ? Number(r.value).toLocaleString("vi-VN") + "đ" : ""}){codeText}{prodText}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontSize: "11px", color: "#475569", fontWeight: "700", display: "block", marginBottom: "4px" }}>Tỷ lệ trúng (%)</label>
                    <input type="number" min="0" max="100" placeholder="VD: 100" style={{ width: "100%", padding: "6px 8px", fontSize: "11px", boxSizing: "border-box" }} value={item.probability} onChange={(e) => handleUpdateRewardRow(idx, "probability", Number(e.target.value))} required />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontSize: "11px", color: "#475569", fontWeight: "700", display: "block", marginBottom: "4px" }}>Số lượng quà</label>
                    <input type="number" min="1" placeholder="VD: 10" style={{ width: "100%", padding: "6px 8px", fontSize: "11px", boxSizing: "border-box" }} value={item.quantity} onChange={(e) => handleUpdateRewardRow(idx, "quantity", Number(e.target.value))} required />
                  </div>

                  <div style={{ paddingBottom: "2px" }}>
                    {rewardItems.length > 1 && (
                      <button type="button" className="danger" style={{ padding: "6px 10px", fontSize: "11px", borderRadius: "6px" }} onClick={() => handleRemoveRewardRow(idx)}>Xóa</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label style={{ minWidth: 0 }}>
            Giới hạn tổng số lần trúng tối đa
            <input type="number" min="0" style={{ width: "100%" }} value={form.maxTotalWins} onChange={(e) => setForm({ ...form, maxTotalWins: e.target.value })} placeholder="Không giới hạn" />
          </label>

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <label className="check">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Đang áp dụng (Active)
            </label>
            <label className="check">
              <input type="checkbox" checked={form.oaRequired} onChange={(e) => setForm({ ...form, oaRequired: e.target.checked })} /> Bắt buộc theo dõi OA
            </label>
          </div>

          <div className="actions">
            <button className="primary">{editing ? "Lưu luật quay" : "Tạo luật quay"}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }}>Hủy</button>}
          </div>
        </form>

        <section className="panel" style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <h2>Danh sách luật quay ({items.length})</h2>
          <div className="items">
            {items.map((item) => {
              const spinNums = (item.spins || []).map((s) => s.spin_number ?? s.spinNumber).filter(Boolean);
              const spinSummary = spinNums.length >= 10 ? "Tất cả các lượt (1 - 10)" : `Lượt: ${spinNums.join(", ")}`;
              return (
                <article className="item reward-item" key={item.id} style={{ minWidth: 0, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</strong>
                    <small style={{ wordBreak: "break-all" }}>Mã: <code>{item.code}</code> · {spinSummary} · Ưu tiên: {item.priority} · {item.active ? "Đang bật" : "Tắt"}</small>
                    <small>{item.spins?.length || 0} cấu hình lượt quay</small>
                  </div>
                  <div className="actions">
                    <button onClick={() => edit(item)}>Sửa</button>
                    <button className="danger" onClick={() => confirmRemove(item.id, item.name)}>Xóa</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Xác nhận Xóa Luật quay"
        message={`Bạn có chắc chắn muốn xóa luật quay '${deleteModal.name}'? Thao tác này không thể hoàn tác.`}
        variant="danger"
        confirmText="Xóa luật quay"
        onConfirm={handleExecuteRemove}
        onCancel={() => setDeleteModal({ isOpen: false, id: null, name: "" })}
      />
    </>
  );
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
  const [successMsg, setSuccessMsg] = useState("");

  const [deleteGroupModal, setDeleteGroupModal] = useState({ isOpen: false, groupId: null, groupName: "" });

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
    api("/admin/customers").then((r) => setAllCustomers(r.items || [])).catch(() => { });
    api("/admin/campaigns").then((r) => {
      const available = r.items || [];
      setCampaigns(available);
      if (!selectedCampaignId && available[0]) setSelectedCampaignId(available[0].id);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) return;
    api(`/admin/campaign-rules?campaignId=${encodeURIComponent(selectedCampaignId)}`)
      .then((r) => setCampaignRules(r.items || []))
      .catch(() => { });
  }, [selectedCampaignId]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    try {
      const created = await api("/admin/groups", {
        method: "POST",
        body: JSON.stringify({ name: newGroupName }),
      });
      setNewGroupName("");
      setSelectedGroupId(created.id);
      setSuccessMsg("Đã tạo nhóm khách hàng mới thành công!");
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRenameGroup = async (id) => {
    if (!renamingName.trim()) return;
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/groups/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: renamingName.trim() }),
      });
      setRenamingGroupId(null);
      setRenamingName("");
      setSuccessMsg("Đã đổi tên nhóm thành công!");
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmDeleteGroup = (id, name) => {
    setError("");
    setDeleteGroupModal({ isOpen: true, groupId: id, groupName: name });
  };

  const handleExecuteDeleteGroup = async () => {
    const { groupId, groupName } = deleteGroupModal;
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/groups/${groupId}`, { method: "DELETE" });
      if (selectedGroupId === groupId) setSelectedGroupId("");
      setSuccessMsg(`Đã xóa nhóm '${groupName}' thành công!`);
      setDeleteGroupModal({ isOpen: false, groupId: null, groupName: "" });
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedGroupId || !selectedCustomerIdToAdd) return;
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/groups/${selectedGroupId}/members`, {
        method: "POST",
        body: JSON.stringify({ customerId: selectedCustomerIdToAdd }),
      });
      setSelectedCustomerIdToAdd("");
      setSuccessMsg("Đã thêm khách hàng vào nhóm thành công!");
      await loadMembersAndRules();
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (customerId) => {
    if (!selectedGroupId) return;
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/groups/${selectedGroupId}/members/${customerId}`, { method: "DELETE" });
      setSuccessMsg("Đã loại khách hàng khỏi nhóm thành công!");
      await loadMembersAndRules();
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleRuleAssignment = async (ruleId, assigned) => {
    if (!selectedGroupId) return;
    setError("");
    setSuccessMsg("");
    try {
      if (assigned) {
        await api(`/admin/groups/${selectedGroupId}/rules/${ruleId}`, { method: "DELETE" });
        setSuccessMsg("Đã hủy gán luật cho nhóm!");
      } else {
        await api(`/admin/groups/${selectedGroupId}/rules/${ruleId}`, { method: "POST" });
        setSuccessMsg("Đã gán luật quay cho nhóm thành công!");
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
      <Header helpTopic="groups" title="Nhóm khách hàng (Customer Groups)" subtitle="Phân nhóm khách hàng (VIP, Đại lý, Nội bộ) để gán thể lệ/luật quay đặc thù theo từng sự kiện." />
      {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}
      {successMsg && <UiAlert type="success" onClose={() => setSuccessMsg("")}>{successMsg}</UiAlert>}
      <div className="split mt-4">
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
                style={{ cursor: "pointer", borderLeft: selectedGroupId === g.id ? "4px solid #e11b22" : "none" }}
                onClick={() => setSelectedGroupId(g.id)}
              >
                <div>
                  {renamingGroupId === g.id ? (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        value={renamingName}
                        onChange={(e) => setRenamingName(e.target.value)}
                        style={{ padding: "4px 8px", width: "120px" }}
                      />
                      <button className="primary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleRenameGroup(g.id)}>Lưu</button>
                      <button style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => setRenamingGroupId(null)}>Hủy</button>
                    </div>
                  ) : (
                    <strong>{g.name}</strong>
                  )}
                  <small>{g.memberCount} thành viên · {g.ruleCount} luật được gán</small>
                </div>
                <div className="actions" style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  {renamingGroupId !== g.id && (
                    <button style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => { setRenamingGroupId(g.id); setRenamingName(g.name); }}>Sửa</button>
                  )}
                  <button className="danger" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => confirmDeleteGroup(g.id, g.name)}>Xóa</button>
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
                <form className="form" onSubmit={handleAddMember} style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 180px", minWidth: "160px" }}>
                    <label style={{ margin: 0, fontSize: "12px", fontWeight: "700" }}>Tìm theo Tên / SĐT</label>
                    <input
                      style={{ marginTop: "4px", width: "100%" }}
                      placeholder="Tìm khách hàng..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: "1 1 200px", minWidth: "180px" }}>
                    <label style={{ margin: 0, fontSize: "12px", fontWeight: "700" }}>Chọn khách hàng</label>
                    <select
                      style={{ marginTop: "4px", width: "100%" }}
                      value={selectedCustomerIdToAdd}
                      onChange={(e) => setSelectedCustomerIdToAdd(e.target.value)}
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {filteredCustomersForAdd.slice(0, 50).map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: "0 0 auto" }}>
                    <button className="primary" style={{ height: "42px", padding: "0 16px", whiteSpace: "nowrap" }} disabled={!selectedCustomerIdToAdd}>
                      Thêm vào nhóm
                    </button>
                  </div>
                </form>

                <div className="table-wrap" style={{ marginTop: "16px" }}>
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

      <ConfirmModal
        isOpen={deleteGroupModal.isOpen}
        title="Xác nhận Xóa nhóm khách hàng"
        message={`Bạn có chắc chắn muốn xóa nhóm '${deleteGroupModal.groupName}'? Thao tác này chỉ xóa nhóm, không xóa tài khoản khách hàng.`}
        variant="danger"
        confirmText="Xóa nhóm"
        onConfirm={handleExecuteDeleteGroup}
        onCancel={() => setDeleteGroupModal({ isOpen: false, groupId: null, groupName: "" })}
      />
    </>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(auth.token));
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [viewMode, setViewMode] = useState("advanced"); // Default to clean Advanced Console mode
  const [operatorStep, setOperatorStep] = useState("overview");
  const [tab, setTab] = useState("overview");

  const loadCampaigns = async () => {
    try {
      const res = await api("/admin/campaigns?includeArchived=true");
      const list = res.items || [];
      setCampaigns(list);
      if (!selectedCampaignId && list.length > 0) {
        setSelectedCampaignId(list[0].id);
      }
    } catch (e) {
      console.error("Unable to load campaigns", e);
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setLoggedIn(false);
    });
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadCampaigns();
    }
  }, [loggedIn]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;

  const handleTransitionStatus = async (campaignId, status) => {
    try {
      await api(`/admin/campaigns/${campaignId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await loadCampaigns();
    } catch (e) {
      alert(`Lỗi chuyển trạng thái: ${e.message}`);
    }
  };

  const handleCloneCampaign = (c) => {
    setOperatorStep("setup");
    setViewMode("operator");
  };



  function SystemSettings() {
    const [configData, setConfigData] = useState({
      appEnv: "development",
      participantAuthMode: "preview",
      adminAuthMode: "development",
      apiBaseUrl: "http://localhost:8787/api/v1",
      zaloAppSecret: "",
      zaloOaId: "",
      zbsApiKey: "",
      zbsTemplateId: "",
      googleSheetsWebhookUrl: "",
      allowUnlisted: false,
      unlistedSpinQuota: 1,
      oaRequired: false,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [copiedKey, setCopiedKey] = useState("");

    const loadConfig = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api("/admin/system-config");
        setConfigData(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadConfig();
    }, []);

    const handleSave = async (e) => {
      e.preventDefault();
      setSaving(true);
      setError("");
      setSuccessMsg("");
      try {
        await api("/admin/system-config", {
          method: "PUT",
          body: JSON.stringify(configData),
        });
        setSuccessMsg("Đã lưu cấu hình môi trường hệ thống thành công!");
        await loadConfig();
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    };

    const copyToClipboard = (text, key) => {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    };

    const backendEnvContent = `PORT=8787
APP_ENV=${configData.appEnv}
PARTICIPANT_AUTH_MODE=${configData.participantAuthMode}
ADMIN_AUTH_MODE=${configData.adminAuthMode}
ZALO_APP_SECRET=${configData.zaloAppSecret === "*****" ? "" : configData.zaloAppSecret}
ZBS_API_KEY=${configData.zbsApiKey === "*****" ? "" : configData.zbsApiKey}
ZBS_TEMPLATE_ID=${configData.zbsTemplateId}
GOOGLE_SHEETS_WEBHOOK_URL=${configData.googleSheetsWebhookUrl}`;

    const miniAppEnvContent = `VITE_API_BASE_URL=${configData.apiBaseUrl}
VITE_PARTICIPANT_AUTH_MODE=${configData.participantAuthMode}
VITE_ZALO_OA_ID=${configData.zaloOaId}`;

    const adminEnvContent = `VITE_API_BASE_URL=${configData.apiBaseUrl}`;

    if (loading) return <div className="card">Đang tải cấu hình môi trường...</div>;

    return (
      <section>
        <Header
          helpTopic="settings"
          title="⚙️ Cấu hình Môi trường (System & Env)"
          subtitle="Quản lý biến môi trường Backend, Zalo Mini App, ZNS Webhook và tham số hệ thống"
        />

        <UiAlert message={error} type="error" onClose={() => setError("")} />
        <UiAlert message={successMsg} type="success" onClose={() => setSuccessMsg("")} />

        <form onSubmit={handleSave} style={{ display: "grid", gap: "20px" }}>
          {/* Card 1: Backend & API Base URL */}
          <div className="card">
            <h2>🌐 Cấu hình Server Backend & API Domain</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <label>
                <strong>Môi trường Chạy (APP_ENV)</strong>
                <select
                  value={configData.appEnv}
                  onChange={(e) => setConfigData({ ...configData, appEnv: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                >
                  <option value="development">🛠️ Development (Thử nghiệm Local)</option>
                  <option value="production">🚀 Production (Vận hành Thực tế)</option>
                </select>
              </label>

              <label>
                <strong>Xác thực Khách hàng (PARTICIPANT_AUTH_MODE)</strong>
                <select
                  value={configData.participantAuthMode}
                  onChange={(e) => setConfigData({ ...configData, participantAuthMode: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                >
                  <option value="preview">🔍 Preview Mode (Cho phép giả lập lượt quay)</option>
                  <option value="zalo">🔒 Zalo Token Auth (Xác thực qua Zalo SDK)</option>
                </select>
              </label>

              <label>
                <strong>Xác thực Quản trị Admin (ADMIN_AUTH_MODE)</strong>
                <select
                  value={configData.adminAuthMode}
                  onChange={(e) => setConfigData({ ...configData, adminAuthMode: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                >
                  <option value="development">🔑 Development (Tài khoản local admin@example.com)</option>
                  <option value="supabase">🛡️ Supabase Auth (Tài khoản bảo mật Supabase)</option>
                </select>
              </label>

              <label>
                <strong>API Base URL (VITE_API_BASE_URL)</strong>
                <input
                  type="text"
                  value={configData.apiBaseUrl}
                  onChange={(e) => setConfigData({ ...configData, apiBaseUrl: e.target.value })}
                  placeholder="http://localhost:8787/api/v1"
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                />
              </label>
            </div>
          </div>

          {/* Card 2: Zalo & ZNS & Google Sheets Integration */}
          <div className="card">
            <h2>🔑 Cấu hình Tích hợp Zalo App & ZBS & Webhook</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <label>
                <strong>Zalo App Secret Key (ZALO_APP_SECRET)</strong>
                <input
                  type="password"
                  value={configData.zaloAppSecret}
                  onChange={(e) => setConfigData({ ...configData, zaloAppSecret: e.target.value })}
                  placeholder="Khóa bí mật Zalo App"
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Zalo Official Account ID (VITE_ZALO_OA_ID)</strong>
                <input
                  type="text"
                  value={configData.zaloOaId}
                  onChange={(e) => setConfigData({ ...configData, zaloOaId: e.target.value })}
                  placeholder="ID Zalo Official Account (OA)"
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>ZBS API Key (Tự động gửi tin nhắn ZNS)</strong>
                <input
                  type="password"
                  value={configData.zbsApiKey}
                  onChange={(e) => setConfigData({ ...configData, zbsApiKey: e.target.value })}
                  placeholder="ZBS API Key"
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>ZBS Template ID (Mẫu tin ZNS gửi Voucher)</strong>
                <input
                  type="text"
                  value={configData.zbsTemplateId}
                  onChange={(e) => setConfigData({ ...configData, zbsTemplateId: e.target.value })}
                  placeholder="ID Mẫu tin ZNS"
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                />
              </label>

              <label style={{ gridColumn: "span 2" }}>
                <strong>Google Sheets Webhook URL (Đồng bộ Báo cáo Realtime)</strong>
                <input
                  type="text"
                  value={configData.googleSheetsWebhookUrl}
                  onChange={(e) => setConfigData({ ...configData, googleSheetsWebhookUrl: e.target.value })}
                  placeholder="https://script.google.com/macros/s/..."
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                />
              </label>
            </div>
          </div>

          {/* Card 3: Mini App Guest Policy Settings */}
          <div className="card">
            <h2>🎮 Cấu hình Chính sách Tham gia Mini App</h2>
            <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={configData.allowUnlisted}
                  onChange={(e) => setConfigData({ ...configData, allowUnlisted: e.target.checked })}
                />
                <span><strong>Cho phép Khách vãng lai (ngoài danh sách) tham gia quay thưởng</strong></span>
              </label>

              {configData.allowUnlisted && (
                <label style={{ width: "280px" }}>
                  <strong>Số lượt quay cấp mặc định cho Khách vãng lai:</strong>
                  <input
                    type="number"
                    min="1"
                    value={configData.unlistedSpinQuota}
                    onChange={(e) => setConfigData({ ...configData, unlistedSpinQuota: e.target.value })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
                  />
                </label>
              )}

              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={configData.oaRequired}
                  onChange={(e) => setConfigData({ ...configData, oaRequired: e.target.checked })}
                />
                <span><strong>Bắt buộc Khách hàng bấm Quan tâm Zalo OA trước khi được quay</strong></span>
              </label>
            </div>
          </div>

          <button className="primary" disabled={saving} style={{ padding: "12px 24px", fontSize: "15px", width: "fit-content" }}>
            {saving ? "Đang lưu cấu hình..." : "💾 Lưu Cấu hình Môi trường"}
          </button>
        </form>

        {/* Card 4: Quick Copy .env snippets */}
        <div className="card" style={{ marginTop: "24px" }}>
          <h2>📋 Bộ sinh file `.env` nhanh cho Deploy</h2>
          <p style={{ color: "#64748b", fontSize: "13px" }}>Sao chép nội dung `.env` chuẩn để dán vào file môi trường Server/MiniApp khi deploy.</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "16px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <strong>🖥️ backend/.env</strong>
                <button
                  type="button"
                  className="secondary"
                  style={{ padding: "3px 8px", fontSize: "11px" }}
                  onClick={() => copyToClipboard(backendEnvContent, "be")}
                >
                  {copiedKey === "be" ? "✓ Đã copy!" : "📋 Copy"}
                </button>
              </div>
              <textarea
                readOnly
                value={backendEnvContent}
                style={{ width: "100%", height: "140px", fontSize: "11px", fontFamily: "monospace", padding: "8px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <strong>📱 lucky-wheels/.env</strong>
                <button
                  type="button"
                  className="secondary"
                  style={{ padding: "3px 8px", fontSize: "11px" }}
                  onClick={() => copyToClipboard(miniAppEnvContent, "mini")}
                >
                  {copiedKey === "mini" ? "✓ Đã copy!" : "📋 Copy"}
                </button>
              </div>
              <textarea
                readOnly
                value={miniAppEnvContent}
                style={{ width: "100%", height: "140px", fontSize: "11px", fontFamily: "monospace", padding: "8px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <strong>🌐 admin-web/.env</strong>
                <button
                  type="button"
                  className="secondary"
                  style={{ padding: "3px 8px", fontSize: "11px" }}
                  onClick={() => copyToClipboard(adminEnvContent, "admin")}
                >
                  {copiedKey === "admin" ? "✓ Đã copy!" : "📋 Copy"}
                </button>
              </div>
              <textarea
                readOnly
                value={adminEnvContent}
                style={{ width: "100%", height: "140px", fontSize: "11px", fontFamily: "monospace", padding: "8px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const advancedPage = useMemo(() => ({
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
    settings: <SystemSettings />,
  }[tab]), [tab]);

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;

  return (
    <div className="admin-root-shell">
      {viewMode === "operator" ? (
        <>
          <EventWorkspace
            campaigns={campaigns}
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
            mode={viewMode}
            onToggleMode={setViewMode}
            onNavigateStep={setOperatorStep}
            onTransitionStatus={handleTransitionStatus}
            onCloneCampaign={handleCloneCampaign}
          />
          <EventWizard
            activeStep={operatorStep}
            onSelectStep={setOperatorStep}
            campaign={selectedCampaign}
            campaigns={campaigns}
            onSelectCampaign={setSelectedCampaignId}
            onCampaignSaved={(newCamp) => {
              loadCampaigns();
              if (newCamp?.id) setSelectedCampaignId(newCamp.id);
            }}
            onTransitionStatus={handleTransitionStatus}
            renderAwardsTab={() => <Awards />}
          />
        </>
      ) : (
        <Shell tab={tab} setTab={setTab} onLogout={() => { logout(); setLoggedIn(false); }}>
          {advancedPage}
        </Shell>
      )}
    </div>
  );
}
