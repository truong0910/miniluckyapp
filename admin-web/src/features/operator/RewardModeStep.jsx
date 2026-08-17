import { useEffect, useState } from "react";

export default function RewardModeStep({ campaign, onNextStep }) {
  const storageKey = campaign?.id ? `reward_mode_${campaign.id}` : "reward_mode_default";
  const [selectedMode, setSelectedMode] = useState(() => {
    return localStorage.getItem(storageKey) || "spin_rule";
  });
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (campaign?.id) {
      const saved = localStorage.getItem(`reward_mode_${campaign.id}`);
      if (saved) setSelectedMode(saved);
    }
  }, [campaign?.id]);

  const handleSelect = (mode) => {
    setSelectedMode(mode);
    if (campaign?.id) {
      localStorage.setItem(`reward_mode_${campaign.id}`, mode);
    }
  };

  const handleNext = () => {
    if (campaign?.id) {
      localStorage.setItem(`reward_mode_${campaign.id}`, selectedMode);
    }
    const modeName =
      selectedMode === "spin_rule"
        ? "Mô hình B (Quay số ngẫu nhiên)"
        : selectedMode === "group"
        ? "Mô hình C (Nhóm đặc biệt VIP)"
        : "Mô hình A (Voucher cấp sẵn từ Excel)";

    setSavedMessage(`Đã ghi nhớ lựa chọn: ${modeName}!`);

    setTimeout(() => {
      if (selectedMode === "spin_rule" || selectedMode === "group") {
        onNextStep("rules");
      } else {
        onNextStep("readiness");
      }
    }, 400);
  };

  return (
    <div className="operator-step-container">
      <div className="step-header-banner">
        <div>
          <h2>Chọn Mô hình Phát thưởng</h2>
          <p>
            Xác định phương thức khách nhận quà trong sự kiện <strong>{campaign?.name}</strong>.
          </p>
        </div>
      </div>

      {savedMessage && <div className="success-card">{savedMessage}</div>}

      <div className="reward-mode-grid">
        {/* Mode A */}
        <div
          className={`reward-mode-option-card ${selectedMode === "voucher" ? "selected" : ""}`}
          onClick={() => handleSelect("voucher")}
          style={{
            cursor: "pointer",
            border: selectedMode === "voucher" ? "2px solid #dc2626" : "1px solid #e2e8f0",
            background: selectedMode === "voucher" ? "#fff5f5" : "#fff",
            position: "relative",
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="mode-badge">MÔ HÌNH A</span>
            {selectedMode === "voucher" && (
              <span className="status-badge badge-active" style={{ background: "#dc2626", color: "#fff" }}>
                ✓ ĐÃ CHỌN MÔ HÌNH NÀY
              </span>
            )}
          </div>
          <h3>Voucher cấp sẵn theo danh sách</h3>
          <p className="mode-desc">
            Dành cho chương trình trao giải đích danh. Mỗi khách khi quay lần lượt từng lượt sẽ nhận đúng Voucher có
            mệnh giá được chuẩn bị sẵn từ file Excel Import.
          </p>
          <ul className="mode-checklist">
            <li>- Không yêu cầu cấu hình tỷ lệ thắng rủi ro</li>
            <li>- Đảm bảo mỗi khách nhận đúng mệnh giá trong Ghi chú</li>
            <li>Lưu ý: Không bật luật mặc định (Default Rule) nếu muốn giữ Voucher cố định</li>
          </ul>
        </div>

        {/* Mode B */}
        <div
          className={`reward-mode-option-card ${selectedMode === "spin_rule" ? "selected" : ""}`}
          onClick={() => handleSelect("spin_rule")}
          style={{
            cursor: "pointer",
            border: selectedMode === "spin_rule" ? "2px solid #dc2626" : "1px solid #e2e8f0",
            background: selectedMode === "spin_rule" ? "#fff5f5" : "#fff",
            position: "relative",
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="mode-badge">MÔ HÌNH B</span>
            {selectedMode === "spin_rule" && (
              <span className="status-badge badge-active" style={{ background: "#dc2626", color: "#fff" }}>
                ✓ ĐÃ CHỌN MÔ HÌNH NÀY
              </span>
            )}
          </div>
          <h3>Quay số trúng quà ngẫu nhiên</h3>
          <p className="mode-desc">
            Dành cho sự kiện quay số may mắn. Khách hàng sử dụng lượt quay để quay thưởng. Kết quả thắng/thua và loại
            quà phụ thuộc vào Tỷ lệ trúng và Tồn kho giải thưởng.
          </p>
          <ul className="mode-checklist">
            <li>- Cấu hình linh hoạt theo từng lượt quay (Lượt 1, Lượt 2, Lượt 3...)</li>
            <li>- Giới hạn số lượng giải thưởng và tỷ lệ thắng tối đa</li>
            <li>- Tự động rơi vào ô "May mắn lần sau" khi hết quà</li>
          </ul>
        </div>

        {/* Mode C */}
        <div
          className={`reward-mode-option-card ${selectedMode === "group" ? "selected" : ""}`}
          onClick={() => handleSelect("group")}
          style={{
            cursor: "pointer",
            border: selectedMode === "group" ? "2px solid #dc2626" : "1px solid #e2e8f0",
            background: selectedMode === "group" ? "#fff5f5" : "#fff",
            position: "relative",
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="mode-badge">MÔ HÌNH C</span>
            {selectedMode === "group" && (
              <span className="status-badge badge-active" style={{ background: "#dc2626", color: "#fff" }}>
                ✓ ĐÃ CHỌN MÔ HÌNH NÀY
              </span>
            )}
          </div>
          <h3>Nhóm đặc biệt (VIP / Đại lý / Khách thân thiết)</h3>
          <p className="mode-desc">
            Áp dụng luật quay ưu đãi riêng cho từng Nhóm khách hàng (như 100% trúng quà lớn cho nhóm VIP).
          </p>
          <ul className="mode-checklist">
            <li>- Phân nhóm khách hàng và gán luật quay ưu tiên cao hơn</li>
            <li>- Tự động ưu tiên luật nhóm trước luật mặc định</li>
          </ul>
        </div>
      </div>

      <div className="form-actions mt-6">
        <button className="btn-primary-lg" onClick={handleNext}>
          {selectedMode === "spin_rule" || selectedMode === "group"
            ? "Tiếp tục: Cấu hình Luật quay ->"
            : "Tiếp tục: Kiểm tra & Kích hoạt ->"}
        </button>
      </div>
    </div>
  );
}
