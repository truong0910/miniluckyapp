# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG QUẢN TRỊ ZALO MINI APP
## CHƯƠNG TRÌNH QUAY SỐ TRÚNG THƯỞNG - HỒNG PHÚC GLASS

---

## MỤC LỤC
1. [Giới thiệu Tổng quan](#1-giới-thiệu-tổng-quan)
2. [Quy trình 6 bước Tạo & Kích hoạt Sự kiện](#2-quy-trình-6-bước-tạo--kích-hoạt-sự-kiện)
   - [Bước 1: Tổng quan sự kiện](#bước-1-tổng-quan-sự-kiện)
   - [Bước 2: Thiết lập sự kiện](#bước-2-thiết-lập-sự-kiện)
   - [Bước 3: Khách tham gia & Import Excel](#bước-3-khách-tham-gia--import-excel)
   - [Bước 4: Chọn Mô hình Phát thưởng](#bước-4-chọn-mô-hình-phát-thưởng)
   - [Bước 5: Cấu hình Luật quay theo Ngôn ngữ Tự nhiên](#bước-5-cấu-hình-luật-quay-theo-ngôn-ngữ-tự-nhiên)
   - [Bước 6: Kiểm tra An toàn & Quay thử (Dry-Run)](#bước-6-kiểm-tra-an-toàn--quay-thử-dry-run)
3. [Quản lý Danh mục & Vận hành chi tiết](#3-quản-lý-danh-mục--vận-hành-chi-tiết)
   - [Quản lý Giải thưởng & Tồn kho](#quản-lý-giải-thưởng--tồn-kho)
   - [Quản lý Banner Truyền thông](#quản-lý-banner-truyền-thông)
   - [Quản lý Nhóm khách hàng (VIP / Đại lý)](#quản-lý-nhóm-khách-hàng-vip--đại-lý)
   - [Kho Voucher & Vận hành Đổi thưởng](#kho-voucher--vận-hành-đổi-thưởng)
   - [Thể lệ chương trình](#thể-lệ-chương-trình)
4. [Tự động Đồng bộ Kết quả sang Google Sheets](#4-tự-động-đồng-bộ-kết-quả-sang-google-sheets)
5. [Giải đáp Thắc mắc Thường gặp (FAQ)](#5-giải-đáp-thắc-mắc-thường-gặp-faq)

---

## 1. Giới thiệu Tổng quan

Hệ thống Quản trị **Hồng Phúc Glass Mini App** là công cụ giúp quản trị viên dễ dàng tạo lập, vận hành và giám sát các chương trình quay số may mắn, phát hành Voucher tri ân khách hàng trực tiếp trên Zalo.

### Các ưu điểm nổi bật:
* **Giao diện thuần tiếng Việt**: Thao tác trực quan, hiện đại với tông màu đỏ nhận diện thương hiệu Hồng Phúc Glass.
* **Cấu hình Luật quay tự nhiên**: Thiết lập tỷ lệ trúng (0% - 100%), số lượng giải thưởng và điều kiện áp dụng mà không cần kiến thức lập trình.
* **Hỗ trợ Import Excel linh hoạt**: Đọc file danh sách khách hàng, tự động nhận diện cột Họ tên, Số điện thoại, Số lượt quay và Mệnh giá Voucher được gán sẵn.
* **Chế độ Quay thử (Dry-Run Simulation)**: Giúp người quản trị kiểm tra thuật toán trao giải thực tế bằng SĐT thử nghiệm trước khi kích hoạt chính thức.
* **Đồng bộ Google Sheets tự động**: Ghi nhận toàn bộ thông tin quay thưởng, mã Voucher, thời gian và thông tin khách hàng sang Google Sheets theo thời gian thực.

---

## 2. Quy trình 6 bước Tạo & Kích hoạt Sự kiện

Khi truy cập giao diện Quản trị sự kiện, hệ thống dẫn dắt bạn qua **6 bước tuần tự**:

```
[1. Tổng quan] ➔ [2. Thiết lập] ➔ [3. Khách tham gia] ➔ [4. Phát thưởng] ➔ [5. Luật quay] ➔ [6. Kích hoạt]
```

---

### Bước 1: Tổng quan sự kiện
* Xem nhanh biểu đồ tổng quan về sự kiện đang chọn.
* Thống kê số lượng khách đăng ký, số lượt quay đã thực hiện, tổng số Voucher đã phát ra và tồn kho quà tặng còn lại.

---

### Bước 2: Thiết lập sự kiện
Tại bước này, bạn định nghĩa các thông tin cơ bản cho chương trình:
1. **Mã sự kiện**: Mã định danh (ví dụ: `SUMMER_2026`).
2. **Tên sự kiện**: Tên hiển thị với khách hàng (ví dụ: `Tri ân Mùa hè 2026`).
3. **Thời gian bắt đầu / Kết thúc**: Ngày giờ diễn ra chương trình.
4. **Cấu hình khách ngoài danh sách (Unlisted Access)**:
   * *Tắt (Khuyên dùng)*: Chỉ những khách hàng có SĐT nằm trong danh sách Import Excel mới được tham gia.
   * *Bật*: Khách hàng mới tự do truy cập Zalo Mini App sẽ được cấp số lượt quay mặc định (ví dụ: 1 lượt).

---

### Bước 3: Khách tham gia & Import Excel
Bước này giúp quản lý danh sách khách hàng được phép tham gia quay số:

#### 🟢 Nhập danh sách khách hàng từ Excel / CSV:
1. Bấm nút **Nhập danh sách khách hàng**.
2. Chọn file `.xlsx` hoặc `.csv` từ máy tính.
3. Hệ thống tự động đọc và khớp các cột:
   * **Họ và tên**: Tên khách hàng.
   * **Số điện thoại**: Tự động chuẩn hóa về định dạng chuẩn 10 số (ví dụ: `0901234567`).
   * **Số lượt quay**: Số lượt quay được cấp cho khách.
   * **Ghi chú / Mệnh giá Voucher**: Mệnh giá Voucher gán đích danh nếu dùng Mô hình A (ví dụ: `5.000.000đ`).
4. Bấm **Xác nhận Import** để lưu danh sách vào sự kiện.

#### ✏️ Chỉnh sửa thông tin khách hàng:
* Bạn có thể bấm nút **Sửa** cạnh bất kỳ khách hàng nào để cập nhật lại Họ tên, SĐT hoặc bổ sung thêm lượt quay.

---

### Bước 4: Chọn Mô hình Phát thưởng
Hệ thống hỗ trợ 3 mô hình phát quà linh hoạt:

* 📌 **MÔ HÌNH A: Voucher cấp sẵn theo danh sách (Cố định đích danh)**
  * *Dành cho*: Chương trình trao giải đã chuẩn bị sẵn danh sách khách kèm mệnh giá Voucher cố định trong file Excel.
  * *Đặc điểm*: Khách bấm quay sẽ nhận đúng mệnh giá được gán trong file Excel, không tính tỷ lệ rủi ro ngẫu nhiên.

* 🎲 **MÔ HÌNH B: Quay số trúng quà ngẫu nhiên (Phổ biến nhất)**
  * *Dành cho*: Sự kiện quay thưởng may mắn công khai.
  * *Đặc điểm*: Kết quả thắng/thua và phần quà dựa trên **Tỷ lệ trúng (%)** và **Tồn kho giải thưởng** cài đặt ở Bước 5.

* 🌟 **MÔ HÌNH C: Nhóm đặc biệt (VIP / Đại lý / Khách thân thiết)**
  * *Dành cho*: Sự kiện có phân hạng khách hàng.
  * *Đặc điểm*: Áp dụng luật quay ưu đãi riêng cho từng Nhóm khách hàng (như *100% trúng quà lớn cho nhóm VIP*).

> *Lưu ý*: Sau khi chọn Mô hình, hệ thống sẽ tự động ghi nhớ lựa chọn của bạn và hiển thị huy hiệu `✓ ĐÃ CHỌN MÔ HÌNH NÀY`.

---

### Bước 5: Cấu hình Luật quay theo Ngôn ngữ Tự nhiên
Đây là nơi bạn thiết lập thuật toán trao quà cho **Mô hình B** và **Mô hình C**:

1. **Nhập Tên mô tả luật**: Ví dụ: `Luật lượt 1 trúng Voucher 10M`.
2. **Chọn Phạm vi áp dụng**:
   * *Tất cả khách hàng (Mặc định)*: Áp dụng chung cho mọi người.
   * *Nhóm khách hàng đặc biệt*: Chọn nhóm VIP hoặc Đại lý.
3. **Cài đặt Lượt quay & Tỷ lệ trúng**:
   * **Lượt thứ**: Chọn lượt quay áp dụng (Lượt 1, Lượt 2, Lượt 3...).
   * **Tỷ lệ trúng (%)**: Nhập từ `0%` đến `100%`. (Ví dụ: `100%` nghĩa là bấm quay là chắc chắn trúng quà).
4. **Chọn Giải thưởng & Số lượng**:
   * Chọn phần quà từ Danh mục (ví dụ: `Voucher mua hàng 10.000.000đ`).
   * Số lượng quà phát hành cho luật này.
5. **Xem Câu tóm tắt Ngôn ngữ Tự nhiên**:
   * Hệ thống tự động sinh ra câu tóm tắt trực quan:
     > *"Lượt 1: Tất cả khách hàng có 100% cơ hội nhận Voucher mua hàng 10.000.000đ (10.000.000đ), tối đa 1 lần. Số lượng quà: 1."*
6. Bấm **Thêm Luật quay** hoặc **Cập nhật Luật quay**.

---

### Bước 6: Kiểm tra An toàn & Quay thử (Dry-Run)

#### 🛡️ Checklist Kiểm tra An toàn (100% Sẵn sàng):
Hệ thống tự động rà soát 5 điều kiện vận hành trước khi cho phép kích hoạt:
1. Đã chọn Sự kiện hợp lệ.
2. Không có sự kiện nào khác đang ở trạng thái ACTIVE (Đang chạy).
3. Đã có Danh sách khách hàng tham gia.
4. Đã có Danh mục giải thưởng hoạt động.
5. Đã cấu hình Mô hình phát thưởng & Luật quay hợp lệ.

#### 🧪 Chế độ Quay thử (Dry-Run Simulation):
* Giúp người quản trị test thử kết quả trước khi tung chương trình ra cho khách thật.
* **Cách thực hiện**:
  1. Nhập SĐT thử nghiệm (ví dụ: `0901234567`).
  2. Chọn lượt quay thử (Lượt 1).
  3. Bấm **Quay thử ngay**.
  4. Hệ thống sẽ mô phỏng và trả về đúng giải thưởng dự kiến (ví dụ: `TRÚNG QUÀ - Voucher mua hàng 10.000.000đ`).
  5. *Đảm bảo*: Chế độ Quay thử không ghi dữ liệu thật, không trừ tồn kho và không gửi ZNS.

#### 🚀 Kích hoạt sự kiện:
* Khi các điều kiện kiểm tra đã đạt 100%, bấm nút **Kích hoạt sự kiện** để chương trình sẵn sàng đón khách quay trên Zalo Mini App.

---

## 3. Quản lý Danh mục & Vận hành chi tiết

Bên cạnh quy trình tạo sự kiện, thanh điều hướng bên trái cung cấp các công cụ quản lý toàn diện:

### Quản lý Giải thưởng & Tồn kho (`/rewards`)
* Khai báo danh mục quà tặng sử dụng chung cho tất cả sự kiện.
* Thiết lập: Tên quà, Mã quà, Giá trị (VNĐ), Mô tả chi tiết, Biểu tượng hiển thị trên vòng quay (Chuông, Ngôi sao, Phong bao...).
* Bật/Tắt trạng thái hoạt động của từng quà.

### Quản lý Banner Truyền thông (`/banners`)
* Đăng tải ảnh banner quảng cáo hiển thị trên trang chủ Mini App.
* Hỗ trợ gán Link liên kết khi khách bấm vào banner.
* Hỗ trợ tính năng kéo vuốt tay (Touch Swipe) mượt mà trên điện thoại.

### Quản lý Nhóm khách hàng (VIP / Đại lý) (`/groups`)
* Phân loại khách hàng vào từng nhóm đối tượng.
* 1 khách hàng có thể thuộc nhiều nhóm cùng lúc.
* Cho phép gán Luật quay ưu đãi có Độ ưu tiên cao cho riêng từng Nhóm.

### Kho Voucher & Vận hành Đổi thưởng (`/awards`)
* Tra cứu danh sách tất cả các Voucher đã được phát hành cho khách hàng.
* Tìm kiếm theo Mã Voucher, Tên khách hàng hoặc Số điện thoại.
* Các thao tác vận hành trực tiếp:
  * **Đổi thưởng**: Xác nhận khách hàng đã sử dụng Voucher tại cửa hàng.
  * **Gửi lại ZNS**: Gửi lại tin nhắn thông báo Voucher qua Zalo cho khách.
  * **Hủy / Chuyển Hết hạn**: Hủy bỏ Voucher vi phạm hoặc gia hạn trạng thái (yêu cầu nhập lý do vận hành).

### Thể lệ chương trình (`/rules`)
* Cấu hình nội dung văn bản hiển thị công khai trên Mini App gồm:
  * **Giới thiệu chung**
  * **Điều kiện tham gia**
  * **Cơ cấu giải thưởng**
  * **Quy định sử dụng Voucher**
* Hỗ trợ nhập liệu thoải mái phím Space (khoảng trắng) và xuống dòng Enter. Bấm **Lưu thể lệ** sẽ xuất hiện thông báo xác nhận màu xanh mượt mà.

---

## 4. Tự động Đồng bộ Kết quả sang Google Sheets

Hệ thống được tích hợp sẵn cơ chế **Đồng bộ tự động theo thời gian thực** với Google Sheets:

* **Tự động ghi nhận**: Ngay khi khách hàng thực hiện quay số thành công trên Zalo Mini App, toàn bộ thông tin lượt quay sẽ được đẩy về Google Sheets.
* **Thông tin đồng bộ bao gồm**:
  1. Thời gian quay (Timestamp).
  2. ID & Tên sự kiện (`campaign_id`, `campaign_name`).
  3. Họ tên & Số điện thoại khách hàng.
  4. Mã Voucher được cấp.
  5. Tên giải thưởng & Mệnh giá quà tặng.
  6. Trạng thái phát quà.
* **Bảo toàn dữ liệu**: Hệ thống luôn nối tiếp (append) dữ liệu mới vào hàng tiếp theo của Google Sheets mà **không làm mất hoặc ghi đè lịch sử cũ**.

---

## 5. Giải đáp Thắc mắc Thường gặp (FAQ)

### ❓ Q1: Tôi cài Luật quay 100% trúng quà 10M, nhưng tại sao khách quay lại trúng 5M hoặc ra "May mắn lần sau"?
* **Trả lời**: Bạn cần kiểm tra 2 yếu tố:
  1. **Tồn kho giải thưởng**: Kiểm tra xem giải 10M có còn số lượng tồn kho không. Nếu hết quà, hệ thống sẽ tự động rơi vào ô "May mắn lần sau".
  2. **Mô hình phát thưởng**: Đảm bảo tại Bước 4 bạn đã chọn **Mô hình B** (Quay số ngẫu nhiên) hoặc **Mô hình C** (Nhóm đặc biệt). Nếu chọn nhầm Mô hình A, hệ thống sẽ đọc mệnh giá gán sẵn trong Excel chứ không đọc Luật %!

### ❓ Q2: Làm sao để thay đổi số lượt quay của một khách hàng đã đăng ký?
* **Trả lời**: Bạn vào **Bước 3 (Khách tham gia)** hoặc menu **Khách hàng**, gõ tìm SĐT khách đó ➔ Bấm nút **Sửa** ➔ Nhập lại số lượt quay ➔ Bấm **Cập nhật**.

### ❓ Q3: Một khách hàng có thể vừa nằm trong nhóm VIP vừa nằm trong nhóm Đại lý không?
* **Trả lời**: **Có**. 1 khách hàng có thể thuộc nhiều nhóm cùng lúc. Hệ thống sẽ so sánh **Độ ưu tiên (Priority)** của các nhóm để chọn Luật quay có ưu đãi cao nhất cho khách hàng đó.

---

*Hồng Phúc Glass - Hệ thống Quản trị Mini App Zalo*  
*Tài liệu ban hành & cập nhật: 2026*
