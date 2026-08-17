import { useState } from "react";

export default function RewardModeStep({ campaign, onNextStep }) {
  const [selectedMode, setSelectedMode] = useState("voucher");

  return (
    <div className="operator-step-container">
      <div className="step-header-banner">
        <div>
          <h2>🎁 Chọn Mô hình Phát thưởng</h2>
          <p>Xác định phương thức khách nhận quà trong sự kiện <strong>{campaign?.name}</strong>.</p>
        </div>
      </div>

      <div className="reward-mode-grid">
        {/* Mode A */}
        <div
          className={`reward-mode-option-card ${selectedMode === "voucher" ? "selected" : ""}`}
          onClick={() => setSelectedMode("voucher")}
        >
          <div className="mode-badge">MÔ HÌNH A</div>
          <h3>🎁 Voucher cấp sẵn theo danh sách</h3>
          <p className="mode-desc">
            Dành cho chương trình trao giải đích danh. Mỗi khách khi quay lần lượt từng lượt sẽ nhận đúng Voucher có
            mệnh giá được chuẩn bị sẵn từ file Excel Import.
          </p>
          <ul className="mode-checklist">
            <li>✅ Không yêu cầu cấu hình tỷ lệ thắng rủi ro</li>
            <li>✅ Đảm bảo mỗi khách nhận đúng mệnh giá trong Ghi chú</li>
            <li>⚠️ Chú ý: Không bật luật mặc định (Default Rule) nếu muốn giữ Voucher cố định</li>
          </ul>
        </div>

        {/* Mode B */}
        <div
          className={`reward-mode-option-card ${selectedMode === "spin_rule" ? "selected" : ""}`}
          onClick={() => setSelectedMode("spin_rule")}
        >
          <div className="mode-badge">MÔ HÌNH B</div>
          <h3>🎰 Quay số trúng quà ngẫu nhiên</h3>
          <p className="mode-desc">
            Dành cho sự kiện quay số may mắn. Khách hàng sử dụng lượt quay để quay thưởng. Kết quả thắng/thua và loại
            quà phụ thuộc vào Tỷ lệ trúng và Tồn kho giải thưởng.
          </p>
          <ul className="mode-checklist">
            <li>✅ Cấu hình linh hoạt theo từng lượt quay (Lượt 1, Lượt 2, Lượt 3...)</li>
            <li>✅ Giới hạn số lượng giải thưởng và tỷ lệ thắng tối đa</li>
            <li>✅ Tự động rơi vào ô "May mắn lần sau" khi hết quà</li>
          </ul>
        </div>

        {/* Mode C */}
        <div
          className={`reward-mode-option-card ${selectedMode === "group" ? "selected" : ""}`}
          onClick={() => setSelectedMode("group")}
        >
          <div className="mode-badge">MÔ HÌNH C</div>
          <h3>⭐ Nhóm đặc biệt (VIP / Đại lý / Khách thân thiết)</h3>
          <p className="mode-desc">
            Áp dụng luật quay ưu đãi riêng cho từng Nhóm khách hàng (như 100% trúng quà lớn cho nhóm VIP).
          </p>
          <ul className="mode-checklist">
            <li>✅ Phân nhóm khách hàng và gán luật quay ưu tiên cao hơn</li>
            <li>✅ Tự động ưu tiên luật nhóm trước luật mặc định</li>
          </ul>
        </div>
      </div>

      <div className="form-actions mt-6">
        <button
          className="btn-primary-lg"
          onClick={() => {
            if (selectedMode === "spin_rule" || selectedMode === "group") {
              onNextStep("rules");
            } else {
              onNextStep("readiness");
            }
          }}
        >
          {selectedMode === "spin_rule" || selectedMode === "group"
            ? "Tiếp tục: Cấu hình Luật quay ➔"
            : "Tiếp tục: Kiểm tra & Kích hoạt ➔"}
        </button>
      </div>
    </div>
  );
}
