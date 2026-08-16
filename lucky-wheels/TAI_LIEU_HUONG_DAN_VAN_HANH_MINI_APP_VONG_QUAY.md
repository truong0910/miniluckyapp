# 📖 TÀI LIỆU HƯỚNG DẪN CHI TIẾT & VẬN HÀNH ỨNG DỤNG VÒNG QUAY MAY MẮN ZALO MINI APP

> **Tài liệu dành cho:** Ban Quản Trị, Bộ phận Marketing, Đội ngũ Vận hành & Khách hàng Doanh nghiệp.

---

## 1. 🚀 TỔNG QUAN VỀ ỨNG DỤNG ZALO MINI APP

Ứng dụng **Vòng Quay May Mắn (Lucky Wheels)** được xây dựng dựa trên công nghệ **Zalo Mini App SDK v2** mới nhất của Zalo.

### 🌟 Ưu điểm nổi bật:
* **Chạy trực tiếp trên Zalo**: Khách hàng không cần cài đặt thêm ứng dụng ngoài, không tốn dung lượng điện thoại.
* **Trải nghiệm tức thì**: Khách hàng chỉ cần quét mã QR Code hoặc bấm link Zalo là vào chơi ngay trong 2 giây.
* **Giao diện chuẩn 3D Casino**: Đồ họa bánh xe Vector SVG với 5 mốc Gradient màu sang trọng, 12 đèn LED viền phát sáng và hiệu ứng âm thanh quay thưởng rực rỡ.

---

## 2. 🗄️ CƠ CHẾ LƯU TRỮ DỮ LIỆU & KẾT NỐI ZALO OFFICIAL ACCOUNT (OA)

### A. Dữ liệu kết quả quay được lưu trữ ở đâu?
Hệ thống áp dụng **cơ chế lưu trữ đa tầng (Multi-tier Storage)** đảm bảo an toàn dữ liệu 100%:

1. **Lưu tại máy Khách Hàng (Client Local Storage)**:
   * Ngay khi bánh xe bắt đầu quay, mã Voucher và kết quả đã được ghi nhận cố định vào bộ nhớ Zalo trên điện thoại khách hàng.
   * **Đảm bảo**: Dù đang quay bị mất mạng hay tắt ứng dụng, khi mở lại Mini App ➔ Mã Voucher vẫn nằm vĩnh viễn trong mục **"Kho Voucher & Lịch sử quay"**. Khách hàng không bao giờ bị mất quà.

2. **Đồng bộ tự động về Google Sheets (Cloud Realtime Sync)**:
   * Mỗi khi có lượt quay trúng thưởng, ứng dụng tự động bắn tin nhắn Webhook POST ghi thẳng 1 dòng mới vào file Google Sheet của Doanh nghiệp.
   * **Thông tin lưu trữ**: `Thời gian quay`, `Họ tên KH`, `Số điện thoại`, `Kết quả (Trúng/May mắn)`, `Giá trị Voucher`, `Tên Voucher`, `Mã Voucher`.

3. **Xuất báo cáo Excel dự phòng (1-Click Excel Export)**:
   * Trên trang Admin (`/admin`), Admin có thể bấm nút **"📊 Xuất Báo Cáo Excel Kết Quả Quay"** bất kỳ lúc nào để tải về file `.xlsx` chứa toàn bộ lịch sử đối soát.

---

### B. Kết nối với Zalo Official Account (OA) & Zalo ZNS thế nào?

1. **Tăng Lượng Follower Cho Zalo OA Doanh Nghiệp**:
   * Khách hàng tham gia chương trình được yêu cầu bấm **"Theo dõi Zalo OA"** của công ty ➔ Giúp doanh nghiệp tích lũy tập khách hàng quan tâm tự nhiên để gửi tin khuyến mãi sau này.
   * *(Lưu ý: Nếu doanh nghiệp chưa gắn ID Zalo OA, ứng dụng có chế độ tự động mở đường cho khách quay mượt mà không bị nghẽn)*.

2. **Gửi Tin Nhắn Xác Nhận Voucher (Zalo ZNS / Zalo Business Solution)**:
   * Khi khách hàng quay trúng giải, ứng dụng có tích hợp sẵn dịch vụ **Zalo ZNS**. Tin nhắn ZNS chứa mã Voucher kèm lời chúc sẽ được gửi thẳng về hộp thư Zalo cá nhân của khách hàng để làm căn cứ đổi quà.

---

## 3. 🔄 KHẢ NĂNG TÁI SỬ DỤNG & CẤU HÌNH CHO CÁC CHƯƠNG TRÌNH SAU

### Doanh nghiệp có bị phụ thuộc hay phát sinh chi phí duy trì không?
👉 **HOÀN TOÀN KHÔNG BỊ PHỤ THUỘC VÀ KHÔNG PHÁT SINH CHI PHÍ DỊCH VỤ!**

* **Quyền sở hữu 100%**: Doanh nghiệp nắm giữ toàn bộ Mini App trên tài khoản Zalo Developer Portal ([mini.zalo.me](https://mini.zalo.me/)).
* **Cấu hình lại siêu tốc cho các chiến dịch tương lai**: Khi muốn chạy chiến dịch mới (ví dụ: *Chương trình Tết, Tri ân 8/3, Khuyến mãi Hè...*), Doanh nghiệp chỉ cần vào trang Admin và thực hiện trong **30 giây**:
  1. **Nạp danh sách khách hàng mới**: Tải file Excel danh sách đợt mới lên.
  2. **Cài đặt lại cơ cấu Voucher**: Phân bổ các mốc Voucher 5M, 4M, 3M, 2M cho đợt mới.
  3. **Chỉnh sửa Thể lệ chương trình**: Cập nhật lại ngày giờ và điều kiện chương trình mới trực tiếp trên giao diện Admin.
  4. **Không cần code lại hay mua ứng dụng mới**: 1 Mini App duy nhất tái sử dụng cho tất cả các chương trình trong năm.

---

## 4. 🛠️ HƯỚNG DẪN CÁC BƯỚC VẬN HÀNH DÀNH CHO DOANH NGHIỆP

### 🔹 BƯỚC 1: Chuẩn Bị Danh Sách Khách Hàng (File Excel)
Tạo file Excel (.xlsx) với các cột tiêu đề chuẩn:
* **Tên KH**: Họ tên hoặc Tên công ty khách hàng.
* **SĐT**: Số điện thoại khách hàng (Ví dụ: `0934252139`).
* **Số vocher tặng**: Số lượt quay muốn cấp (Ví dụ: `3` hoặc `5`).
* **Ghi chú**: Cơ cấu Voucher cấp (Ví dụ: `5 triệu , 5 triệu , 3 triệu`).

### 🔹 BƯỚC 2: Đăng Nhập Trang Admin Quản Lý
1. Mở ứng dụng Zalo Mini App.
2. Tại ô nhập SĐT, gõ chữ: **`admin`**
3. Nhập mật khẩu PIN Quản trị viên (Mặc định: **`123456`**).

### 🔹 BƯỚC 3: Tải Danh Sách Lên Hệ Thống
1. Kéo xuống **Mục 2: Nhập file Excel danh sách tặng Voucher**.
2. Bấm chọn file Excel vừa chuẩn bị ➔ Bấm nút **"🚀 LƯU TẤT CẢ KHÁCH HÀNG VÀO HỆ THỐNG"**.

### 🔹 BƯỚC 4: Gắn Link Google Sheet Nhận Báo Cáo
1. Kéo xuống **Mục 5: Cấu hình Webhook & Link Google Sheet**.
2. Dán link Google Sheet của bạn vào ô ➔ Bấm **"💾 LƯU CẤU HÌNH WEBHOOK & GOOGLE SHEET"**.

### 🔹 BƯỚC 5: Phát Hành & Quảng Bá
1. Vào trang [mini.zalo.me](https://mini.zalo.me/) tải mã **QR Code chính thức** của Mini App.
2. In mã QR Code lên Standee tại cửa hàng, Banner sự kiện hoặc gửi link qua Zalo OA / Zalo ZNS để khách hàng bắt đầu quét và trải nghiệm quay thưởng!

---

## 📞 KÊNH HỖ TRỢ KỸ THUẬT
* **Tài liệu cấu hình chi tiết**: Được lưu tại bộ mã nguồn Mini App.
* **Hỗ trợ cập nhật & bảo trì**: Đội ngũ kỹ thuật sẵn sàng hỗ trợ 24/7 khi doanh nghiệp khởi tạo các chiến dịch mới.

---
*Chúc Doanh nghiệp triển khai chương trình thành công rực rỡ!* 🚀
