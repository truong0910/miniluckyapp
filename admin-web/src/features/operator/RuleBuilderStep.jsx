import { useEffect, useState } from "react";
import { api } from "../../api.js";
import UiAlert from "../../components/common/UiAlert.jsx";

const EMPTY_RULE = {
  name: "",
  code: "",
  scope: "default",
  active: true,
  priority: 100,
  oaRequired: false,
  allowUnlisted: false,
  winRate: 100,
  maxWins: 1,
  maxTotalWins: "",
  startsAt: "",
  endsAt: "",
};

export default function RuleBuilderStep({ campaign, onNextStep }) {
  const [rules, setRules] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(EMPTY_RULE);

  // Multi-spin selection state: "all" | "range" | "custom"
  const [spinMode, setSpinMode] = useState("all");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(5);
  const [customSpins, setCustomSpins] = useState([1, 2, 3, 4, 5]);

  // Multi-reward list state: [{ rewardId, probability, quantity }]
  const [rewardItems, setRewardItems] = useState([
    { rewardId: "", probability: 100, quantity: 10 },
  ]);

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
      const items = rewardsRes.items || [];
      setRewards(items);
      setGroups(groupsRes.items || []);
      if (items.length > 0) {
        setRewardItems((prev) =>
          prev.map((rw) => ({
            ...rw,
            rewardId: rw.rewardId && items.some((r) => String(r.id) === String(rw.rewardId))
              ? rw.rewardId
              : items[0].id,
          }))
        );
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
    const nextRewardId = rewards[0]?.id || "";
    setRewardItems((prev) => [...prev, { rewardId: nextRewardId, probability: 100, quantity: 5 }]);
  };

  const handleRemoveRewardRow = (index) => {
    if (rewardItems.length <= 1) return;
    setRewardItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateRewardRow = (index, field, value) => {
    setRewardItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const toggleCustomSpin = (spinNum) => {
    setCustomSpins((prev) =>
      prev.includes(spinNum) ? prev.filter((s) => s !== spinNum) : [...prev, spinNum]
    );
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!form.name.trim()) {
      setError("Vui lòng nhập tên mô tả cho luật quay");
      return;
    }

    const targetSpins = getTargetSpins();
    if (targetSpins.length === 0) {
      setError("Vui lòng chọn ít nhất 1 lượt quay áp dụng");
      return;
    }

    const validRewards = rewardItems.filter((rw) => rw.rewardId && Number(rw.quantity) > 0);
    if (validRewards.length === 0) {
      setError("Vui lòng chọn ít nhất 1 Giải thưởng hợp lệ cho luật quay");
      return;
    }

    try {
      const payload = {
        campaignId: campaign.id,
        name: form.name,
        code: form.code ? form.code.trim() : undefined,
        scope: form.scope,
        active: form.active !== false,
        priority: Number(form.priority ?? 100),
        oaRequired: Boolean(form.oaRequired),
        allowUnlisted: Boolean(form.allowUnlisted),
        maxTotalWins: form.maxTotalWins !== "" && form.maxTotalWins != null ? Number(form.maxTotalWins) : null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        spins: targetSpins.map((spinNum) => ({
          spinNumber: spinNum,
          winRate: Number(form.winRate ?? 100),
          maxWins: Number(form.maxWins || 1),
          rewards: validRewards.map((rw) => ({
            rewardId: rw.rewardId,
            probability: Number(rw.probability ?? 100),
            quantity: Number(rw.quantity ?? 1),
          })),
        })),
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
      setSpinMode("all");
      setRewardItems([{ rewardId: rewards[0]?.id || "", probability: 100, quantity: 10 }]);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditRule = (r) => {
    setEditingId(r.id);
    const existingSpins = (r.spins || []).map((s) => s.spinNumber ?? s.spin_number).filter(Boolean);
    if (existingSpins.length >= 10) {
      setSpinMode("all");
    } else if (existingSpins.length > 1) {
      setSpinMode("custom");
      setCustomSpins(existingSpins);
    } else {
      setSpinMode("custom");
      setCustomSpins(existingSpins.length > 0 ? existingSpins : [1]);
    }

    const firstSpin = r.spins?.[0] || {};
    const existingRewards = (firstSpin.rewards || []).map((rw) => ({
      rewardId: rw.rewardId || rw.reward_id || rewards[0]?.id || "",
      probability: rw.probability ?? 100,
      quantity: rw.quantity ?? 1,
    }));

    const parseLocalDate = (isoStr) => {
      if (!isoStr) return "";
      try {
        const d = new Date(isoStr);
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      } catch {
        return "";
      }
    };

    setForm({
      name: r.name || "",
      code: r.code || "",
      scope: r.scope || "default",
      active: r.active !== false,
      priority: r.priority ?? 100,
      oaRequired: r.oaRequired ?? r.oa_required ?? false,
      allowUnlisted: r.allowUnlisted ?? r.allow_unlisted ?? false,
      maxTotalWins: r.maxTotalWins ?? r.max_total_wins ?? "",
      startsAt: parseLocalDate(r.startsAt || r.starts_at),
      endsAt: parseLocalDate(r.endsAt || r.ends_at),
      winRate: firstSpin.winRate ?? firstSpin.win_rate ?? 100,
      maxWins: firstSpin.maxWins ?? firstSpin.max_wins ?? 1,
    });

    setRewardItems(existingRewards.length > 0 ? existingRewards : [{ rewardId: rewards[0]?.id || "", probability: 100, quantity: 10 }]);
  };

  const targetSpins = getTargetSpins();
  const targetSpinsText = spinMode === "all" ? "Tất cả các lượt quay (1 - 50)" : spinMode === "range" ? `Các lượt từ ${rangeStart} đến ${rangeEnd}` : `Lượt quay ${targetSpins.join(", ")}`;
  const rewardSummaryText = rewardItems
    .map((rw) => {
      const found = rewards.find((r) => String(r.id) === String(rw.rewardId));
      const prod = found?.applicableProducts || found?.applicable_products;
      const prodText = prod ? ` [${prod}]` : "";
      return found ? `${found.title}${prodText} (${rw.probability}% - ${rw.quantity} phần)` : "";
    })
    .filter(Boolean)
    .join(" + ");

  const summarySentence = `${targetSpinsText}: ${
    form.scope === "group"
      ? "Khách hàng thuộc Nhóm đặc biệt"
      : form.scope === "guest"
      ? "Khách ngoài danh sách"
      : form.scope === "user"
      ? "Khách chỉ định"
      : "Tất cả khách hàng"
  } có ${form.winRate ?? 100}% cơ hội trúng quà. Cơ cấu quà: ${rewardSummaryText || "Chưa chọn quà"}.`;

  return (
    <div className="operator-step-container">
      <div className="step-header-banner">
        <div>
          <h2>Cấu hình Luật quay đa lượt &amp; Cơ cấu Đa giải thưởng</h2>
          <p>Thiết lập tỷ lệ trúng cho nhiều lượt quay cùng lúc và phân bổ nhiều phần quà cho sự kiện <strong>{campaign?.name}</strong>.</p>
        </div>
      </div>

      {error && <UiAlert type="error" onClose={() => setError("")}>{error}</UiAlert>}
      {successMsg && <UiAlert type="success" onClose={() => setSuccessMsg("")}>{successMsg}</UiAlert>}

      <div className="rule-layout-grid">
        {/* Left column: Rule creation form */}
        <form onSubmit={handleSaveRule} className="operator-form-card">
          <h3>{editingId ? "Chỉnh sửa Luật quay" : "Thêm Luật quay mới"}</h3>

          <div className="form-group">
            <label className="form-label">Tên mô tả luật quay *</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Luật chung cho tất cả lượt quay (70% trúng quà 10M, 30% trúng 5M)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Áp dụng cho đối tượng khách hàng *</label>
            <select
              className="form-control"
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
            >
              <option value="default">Tất cả khách hàng trong sự kiện (Mặc định)</option>
              <option value="guest">Khách ngoài danh sách (Tự đăng ký Zalo/preview)</option>
              <option value="group">Nhóm khách hàng cụ thể</option>
              <option value="user">Khách hàng chỉ định riêng (Override)</option>
            </select>
          </div>

          {/* MULTI-SPIN SELECTION CONTROLS */}
          <div className="operator-card-section mb-3" style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
            <label className="form-label" style={{ marginBottom: "8px" }}>Áp dụng tại Lượt quay số nào? *</label>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="spinMode"
                  checked={spinMode === "all"}
                  onChange={() => setSpinMode("all")}
                />
                <span>Tất cả các lượt quay (1 - 50)</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="spinMode"
                  checked={spinMode === "range"}
                  onChange={() => setSpinMode("range")}
                />
                <span>Khoảng lượt (VD: Lượt 1 đến 20)</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="spinMode"
                  checked={spinMode === "custom"}
                  onChange={() => setSpinMode("custom")}
                />
                <span>Chọn lượt cụ thể</span>
              </label>
            </div>

            {spinMode === "range" && (
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Từ lượt quay số:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-control"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Đến lượt quay số:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-control"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            {spinMode === "custom" && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((num) => (
                  <label
                    key={num}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: customSpins.includes(num) ? "2px solid #dc2626" : "1px solid #cbd5e1",
                      background: customSpins.includes(num) ? "#fef2f2" : "#fff",
                      color: customSpins.includes(num) ? "#dc2626" : "#475569",
                      fontWeight: "700",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ display: "none" }}
                      checked={customSpins.includes(num)}
                      onChange={() => toggleCustomSpin(num)}
                    />
                    Lượt {num}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Cơ hội trúng quà của Lượt (%) *</label>
              <input
                type="number"
                min={0}
                max={100}
                className="form-control"
                value={form.winRate}
                onChange={(e) => setForm({ ...form, winRate: Number(e.target.value) })}
                required
              />
              <small className="form-help">VD: 100 = 100% trúng quà. 80 = 80% trúng, 20% ra "May mắn lần sau".</small>
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

          {/* MULTI-REWARD SELECTION LIST */}
          <div className="operator-card-section mb-3" style={{ background: "#fff", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <label className="form-label" style={{ margin: 0 }}>Cơ cấu Giải thưởng trong luật quay *</label>
              <button
                type="button"
                className="btn-link"
                style={{ fontSize: "12px", fontWeight: "800", color: "#dc2626" }}
                onClick={handleAddRewardRow}
              >
                + Thêm phần quà thứ {rewardItems.length + 1}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {rewardItems.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr auto", gap: "8px", alignItems: "center", background: "#f8fafc", padding: "10px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>Giải thưởng {idx + 1}</label>
                    <select
                      className="form-control"
                      style={{ padding: "6px 8px", fontSize: "12px" }}
                      value={item.rewardId || rewards[0]?.id || ""}
                      onChange={(e) => handleUpdateRewardRow(idx, "rewardId", e.target.value)}
                      required
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
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>Tỷ lệ trúng (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-control"
                      style={{ padding: "6px 8px", fontSize: "12px" }}
                      value={item.probability}
                      onChange={(e) => handleUpdateRewardRow(idx, "probability", Number(e.target.value))}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>Số lượng phần quà</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      style={{ padding: "6px 8px", fontSize: "12px" }}
                      value={item.quantity}
                      onChange={(e) => handleUpdateRewardRow(idx, "quantity", Number(e.target.value))}
                      required
                    />
                  </div>

                  <div style={{ paddingTop: "14px" }}>
                    {rewardItems.length > 1 && (
                      <button
                        type="button"
                        className="danger"
                        style={{ padding: "6px 10px", fontSize: "11px", borderRadius: "6px" }}
                        onClick={() => handleRemoveRewardRow(idx)}
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Natural language summary box */}
          <div className="natural-summary-box">
            <span className="summary-label">Tóm tắt thuật toán quy tắc sẽ áp dụng:</span>
            <p className="summary-text">{summarySentence}</p>
          </div>

          {/* Advanced technical settings accordion */}
          <div className="accordion-wrapper mb-4" style={{ marginTop: "12px" }}>
            <button
              type="button"
              className="accordion-toggle"
              style={{ width: "100%", padding: "10px 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "10px", color: "#334155", fontWeight: "700", fontSize: "13px", cursor: "pointer", textAlign: "left" }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "▼ Ẩn Cài đặt Kỹ thuật Nâng cao" : "▶ Hiển thị Cài đặt Kỹ thuật Nâng cao (Mã rule, Khung giờ Flash-sale, Ưu tiên...)"}
            </button>

            {showAdvanced && (
              <div className="accordion-content" style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px", background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Mã định danh Luật (Code)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: RULE_VIP_SUMMER_01"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                    />
                    <small className="form-help">Để trống để hệ thống tự tạo mã định danh duy nhất.</small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Độ ưu tiên (Priority)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                    />
                    <small className="form-help">Số lớn hơn sẽ có độ ưu tiên đánh giá trước (Mặc định: 100).</small>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Giới hạn tổng số lượt trúng tối đa</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder="Không giới hạn"
                      value={form.maxTotalWins}
                      onChange={(e) => setForm({ ...form, maxTotalWins: e.target.value })}
                    />
                    <small className="form-help">Giới hạn tổng số phần quà phát ra cho toàn luật quay này.</small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Khung thời gian áp dụng riêng</label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        type="datetime-local"
                        className="form-control"
                        style={{ fontSize: "12px" }}
                        value={form.startsAt}
                        onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                      />
                      <span>➔</span>
                      <input
                        type="datetime-local"
                        className="form-control"
                        style={{ fontSize: "12px" }}
                        value={form.endsAt}
                        onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                      />
                    </div>
                    <small className="form-help">Dùng cho luật Flash-sale. Để trống nếu áp dụng xuyên suốt sự kiện.</small>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "6px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.active !== false}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                    <span>Bật áp dụng Luật quay này (Active)</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.oaRequired}
                      onChange={(e) => setForm({ ...form, oaRequired: e.target.checked })}
                    />
                    <span>Bắt buộc theo dõi Zalo OA</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.allowUnlisted}
                      onChange={(e) => setForm({ ...form, allowUnlisted: e.target.checked })}
                    />
                    <span>Áp dụng cho cả khách tự do ngoài danh sách</span>
                  </label>
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
                  setSpinMode("all");
                  setRewardItems([{ rewardId: rewards[0]?.id || "", probability: 100, quantity: 10 }]);
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
              {rules.map((r) => {
                const firstSpin = r.spins?.[0] || {};
                const spinNums = (r.spins || []).map((s) => s.spinNumber ?? s.spin_number).filter(Boolean);
                const winRateVal = firstSpin.winRate ?? firstSpin.win_rate ?? 100;
                const spinSummary = spinNums.length >= 10 ? "Tất cả các lượt (1 - 10)" : `Lượt quay: ${spinNums.join(", ")}`;
                
                const rewardSummary = (firstSpin.rewards || []).map((rw) => {
                  const matched = rewards.find((w) => String(w.id) === String(rw.rewardId || rw.reward_id));
                  return `${matched ? matched.title : "Giải thưởng"} (${rw.quantity || 1} phần - ${rw.probability ?? 100}%)`;
                }).join(" + ");

                return (
                  <div key={r.id} className="rule-item-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
                    <div className="rule-item-header" style={{ display: "flex", justifyBetween: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "14px", color: "#0f172a" }}>{r.name}</strong>
                      <span className={`status-tag ${r.active ? "active" : "inactive"}`} style={{ fontSize: "11px", fontWeight: "800", padding: "3px 8px", borderRadius: "6px", background: r.active ? "#dcfce7" : "#f1f5f9", color: r.active ? "#15803d" : "#64748b" }}>
                        {r.active ? "Đang bật" : "Tắt"}
                      </span>
                    </div>

                    <p className="rule-item-detail" style={{ margin: "6px 0", color: "#1e293b", fontSize: "13px" }}>
                      📍 <strong>{spinSummary}</strong> | Tỷ lệ trúng: <strong style={{ color: "#dc2626" }}>{winRateVal}%</strong>
                    </p>

                    <p className="rule-item-detail" style={{ margin: "4px 0", color: "#475569", fontSize: "12px" }}>
                      🎁 <strong>Giải thưởng:</strong> {rewardSummary || "Chưa cài đặt quà"}
                    </p>

                    <p className="rule-item-detail" style={{ margin: "4px 0", color: "#64748b", fontSize: "11px" }}>
                      Mã: <code>{r.code}</code> | Ưu tiên: <code>{r.priority}</code> | Khách ngoài danh sách: {r.allowUnlisted || r.allow_unlisted ? "Có" : "Không"}
                    </p>

                    <div className="rule-item-actions" style={{ marginTop: "8px" }}>
                      <button
                        className="btn-link"
                        style={{ fontSize: "12px", fontWeight: "800", color: "#dc2626", background: "none", border: 0, cursor: "pointer" }}
                        onClick={() => handleEditRule(r)}
                      >
                        Chỉnh sửa luật
                      </button>
                    </div>
                  </div>
                );
              })}
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
