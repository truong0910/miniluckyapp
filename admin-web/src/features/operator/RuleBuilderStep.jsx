import { useEffect, useState } from "react";
import { api } from "../../api.js";

const EMPTY_RULE = {
  name: "",
  scope: "default",
  active: true,
  priority: 100,
  oaRequired: false,
  spinNumber: 1,
  winRate: 80,
  maxWins: 1,
  rewardId: "",
  quantity: 10,
};

export default function RuleBuilderStep({ campaign, onNextStep }) {
  const [rules, setRules] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(EMPTY_RULE);
  const [editingId, setEditingId] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = async () => {
    if (!campaign?.id) return;
    setLoading(true);
    try {
      const [rulesRes, rewardsRes, groupsRes] = await Promise.all([
        api(`/admin/campaign-rules?campaignId=${campaign.id}`),
        api("/admin/rewards"),
        api("/admin/groups"),
      ]);
      setRules(rulesRes.items || []);
      setRewards(rewardsRes.items || []);
      setGroups(groupsRes.items || []);
      if (rewardsRes.items?.[0]) {
        setForm((f) => ({ ...f, rewardId: f.rewardId || rewardsRes.items[0].id }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaign?.id]);

  const handleSaveRule = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!form.name.trim()) {
      setError("Vui lòng nhập tên mô tả cho luật quay");
      return;
    }
    if (!form.rewardId) {
      setError("Vui lòng chọn Giải thưởng cho luật quay");
      return;
    }

    try {
      const selectedReward = rewards.find((r) => r.id === form.rewardId);
      const payload = {
        campaignId: campaign.id,
        name: form.name,
        scope: form.scope,
        active: form.active !== false,
        priority: Number(form.priority || 100),
        oaRequired: Boolean(form.oaRequired),
        spins: [
          {
            spinNumber: Number(form.spinNumber || 1),
            winRate: Number(form.winRate || 0),
            maxWins: Number(form.maxWins || 1),
            rewards: [
              {
                rewardId: form.rewardId,
                probability: 100,
                quantity: Number(form.quantity || 1),
              },
            ],
          },
        ],
      };

      if (editingId) {
        await api(`/admin/campaign-rules/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccessMsg("Đã cập nhật luật quay thành công!");
      } else {
        await api("/admin/campaign-rules", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccessMsg("Đã tạo mới luật quay thành công!");
      }
      setForm(EMPTY_RULE);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const selectedReward = rewards.find((r) => r.id === form.rewardId);

  // Generate natural language summary sentence
  const summarySentence = `Lượt ${form.spinNumber}: ${
    form.scope === "group" ? "Khách hàng nhóm đặc biệt" : "Tất cả khách hàng"
  } có ${form.winRate}% cơ hội nhận ${selectedReward ? selectedReward.title : "Giải thưởng"} (${
    selectedReward?.value ? selectedReward.value.toLocaleString("vi-VN") + "đ" : ""
  }), tối đa ${form.maxWins} lần. Số lượng quà: ${form.quantity}.`;

  return (
    <div className="operator-step-container">
      <div className="step-header-banner">
        <div>
          <h2>Cấu hình Luật quay theo Ngôn ngữ Tự nhiên</h2>
          <p>Thiết lập tỷ lệ trúng và giải thưởng cho sự kiện <strong>{campaign?.name}</strong>.</p>
        </div>
      </div>

      {error && <div className="error-card">{error}</div>}
      {successMsg && <div className="success-card">{successMsg}</div>}

      <div className="rule-layout-grid">
        {/* Left column: Natural language form */}
        <form onSubmit={handleSaveRule} className="operator-form-card">
          <h3>{editingId ? "Chỉnh sửa Luật quay" : "Thêm Luật quay mới"}</h3>

          <div className="form-group">
            <label className="form-label">Tên mô tả luật quay *</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Lượt 1 quay trúng Voucher 5 triệu cho khách VIP"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Áp dụng cho đối tượng *</label>
              <select
                className="form-control"
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
              >
                <option value="default">Tất cả khách hàng sự kiện</option>
                <option value="group">Nhóm khách hàng đặc biệt</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Áp dụng tại lượt quay số *</label>
              <select
                className="form-control"
                value={form.spinNumber}
                onChange={(e) => setForm({ ...form, spinNumber: Number(e.target.value) })}
              >
                <option value={1}>Lượt quay 1</option>
                <option value={2}>Lượt quay 2</option>
                <option value={3}>Lượt quay 3</option>
                <option value={4}>Lượt quay 4</option>
                <option value={5}>Lượt quay 5</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Cơ hội trúng quà (%) *</label>
              <input
                type="number"
                min={0}
                max={100}
                className="form-control"
                value={form.winRate}
                onChange={(e) => setForm({ ...form, winRate: Number(e.target.value) })}
                required
              />
              <small className="form-help">VD: 80 nghĩa là 80% trúng quà, 20% vào May mắn lần sau.</small>
            </div>

            <div className="form-group">
              <label className="form-label">Chọn Giải thưởng *</label>
              <select
                className="form-control"
                value={form.rewardId}
                onChange={(e) => setForm({ ...form, rewardId: e.target.value })}
                required
              >
                {rewards.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.value ? r.value.toLocaleString("vi-VN") + "đ" : ""})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Số lượng phần quà tối đa *</label>
              <input
                type="number"
                min={1}
                className="form-control"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mỗi khách được trúng tối đa (lần) *</label>
              <input
                type="number"
                min={1}
                className="form-control"
                value={form.maxWins}
                onChange={(e) => setForm({ ...form, maxWins: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          {/* Natural language preview box */}
          <div className="natural-summary-box">
            <span className="summary-label">Câu tóm tắt quy tắc sẽ áp dụng:</span>
            <p className="summary-text">{summarySentence}</p>
          </div>

          {/* Advanced technical settings accordion */}
          <div className="accordion-wrapper">
            <button
              type="button"
              className="accordion-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "Ẩn Cài đặt Kỹ thuật Nâng cao" : "Hiển thị Cài đặt Kỹ thuật Nâng cao"}
            </button>

            {showAdvanced && (
              <div className="accordion-content">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Độ ưu tiên (Priority)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                    />
                    <small className="form-help">Ưu tiên cao hơn sẽ được đánh giá trước.</small>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label mt-6">
                      <input
                        type="checkbox"
                        checked={form.oaRequired}
                        onChange={(e) => setForm({ ...form, oaRequired: e.target.checked })}
                      />
                      <span>Bắt buộc theo dõi Zalo OA</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingId ? "Cập nhật Luật quay" : "Thêm Luật quay"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_RULE);
                }}
              >
                Hủy bỏ
              </button>
            )}
          </div>
        </form>

        {/* Right column: List of existing rules */}
        <div className="operator-card-section">
          <h3>Danh sách Luật quay đang áp dụng ({rules.length})</h3>

          {loading ? (
            <div className="loading-state">Đang tải danh sách luật quay...</div>
          ) : rules.length === 0 ? (
            <div className="empty-state">
              Chưa có luật quay nào. Bạn có thể thêm luật quay bên trái hoặc sử dụng Mô hình Voucher cấp sẵn.
            </div>
          ) : (
            <div className="rule-cards-list">
              {rules.map((r) => (
                <div key={r.id} className="rule-item-card">
                  <div className="rule-item-header">
                    <strong>{r.name}</strong>
                    <span className={`status-tag ${r.active ? "active" : "inactive"}`}>
                      {r.active ? "Đang bật" : "Tắt"}
                    </span>
                  </div>

                  <p className="rule-item-detail">
                    Scope: <code>{r.scope}</code> | Ưu tiên: <code>{r.priority}</code>
                  </p>

                  <div className="rule-item-actions">
                    <button
                      className="btn-link"
                      onClick={() => {
                        setEditingId(r.id);
                        setForm({
                          name: r.name,
                          scope: r.scope,
                          active: r.active,
                          priority: r.priority,
                          oaRequired: r.oaRequired,
                          spinNumber: r.spins?.[0]?.spinNumber || 1,
                          winRate: r.spins?.[0]?.winRate || 80,
                          maxWins: r.spins?.[0]?.maxWins || 1,
                          rewardId: r.spins?.[0]?.rewards?.[0]?.rewardId || "",
                          quantity: r.spins?.[0]?.rewards?.[0]?.quantity || 1,
                        });
                      }}
                    >
                      Sửa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <button className="btn-primary-lg w-full" onClick={() => onNextStep("readiness")}>
              Tiếp tục: Kiểm tra &amp; Kích hoạt Sự kiện -&gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
