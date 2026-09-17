# Thiết kế Admin dễ sử dụng cho người chạy sự kiện

**Ngày:** 2026-08-17  
**Trạng thái:** Đã được duyệt để lập kế hoạch triển khai  
**Đối tượng:** Nhân viên vận hành sự kiện, không cần biết kỹ thuật

## 1. Mục tiêu

Biến Admin Web hiện tại từ một bảng điều khiển kỹ thuật thành công cụ vận hành theo quy trình. Người chạy sự kiện phải có thể:

1. Tạo hoặc chọn một sự kiện.
2. Import khách từ Excel/CSV và kiểm tra lỗi trước khi ghi dữ liệu.
3. Chọn rõ mô hình phát thưởng: voucher cấp sẵn, quay ngẫu nhiên hoặc rule cho nhóm đặc biệt.
4. Cấu hình luật quay bằng ngôn ngữ dễ hiểu.
5. Chạy thử an toàn trước khi mở sự kiện.
6. Kích hoạt, tạm dừng, kết thúc và theo dõi kết quả ở một màn hình thống nhất.

Người vận hành không bị buộc phải hiểu `campaign_id`, `rule_id`, `scope`, `priority`, `probability` hoặc cơ chế fallback của database để hoàn thành một sự kiện.

## 2. Nguyên tắc UX

- **Một sự kiện làm việc tại một thời điểm:** luôn hiển thị sự kiện hiện tại ở thanh đầu trang; mọi thao tác phải có campaign context rõ ràng.
- **Nghiệp vụ trước, kỹ thuật sau:** mặc định chỉ hiện các trường người vận hành cần; trường kỹ thuật nằm trong mục **Nâng cao**.
- **Không để cấu hình mâu thuẫn:** hệ thống phải cảnh báo trước khi lưu/kích hoạt thay vì để Admin tự đoán.
- **Không phá dữ liệu lịch sử:** không có thao tác reset hoặc xoá spin, award, delivery, voucher lịch sử.
- **Có thể quay lại:** mỗi bước trong wizard giữ dữ liệu đã nhập và cho phép quay lại sửa trước khi kích hoạt.
- **Ngôn ngữ nhất quán:** dùng tiếng Việt cho nhãn chính; mã kỹ thuật chỉ hiển thị khi mở nâng cao.
- **Hiển thị kết quả dự kiến:** sau mỗi thay đổi, Admin nhìn thấy khách nào sẽ nhận rule nào và điều kiện nào khiến khách nhận “May mắn lần sau”.

## 3. Mô hình khái niệm cần giải thích trong UI

| Khái niệm | Ý nghĩa với người vận hành |
|---|---|
| Sự kiện | Một chương trình quay riêng, có thời gian, khách và lịch sử riêng |
| Khách sự kiện | Khách được đăng ký vào sự kiện và có quota quay |
| Giải thưởng | Danh mục quà có thể được dùng trong rule |
| Voucher cấp sẵn | Voucher đã gán cho từng khách từ file import |
| Luật quay | Điều kiện quyết định khách có trúng và nhận giải gì |
| Nhóm khách | Phân loại dùng để áp dụng rule riêng, ví dụ VIP |
| Kho Voucher | Kết quả đã phát và trạng thái vận hành của voucher |
| Thể lệ | Nội dung giải thích cho khách; không thay đổi thuật toán quay |

UI phải nói rõ: **voucher cấp sẵn và quay ngẫu nhiên là hai mô hình khác nhau**. Không được để người vận hành bật rule Default mà không biết rule đó có thể thay thế voucher cấp sẵn.

## 4. Cấu trúc điều hướng mới

### 4.1. Thanh đầu trang dùng chung

Mọi trang vận hành đều có:

- Tên sự kiện hiện tại.
- Mã sự kiện.
- Trạng thái: `Nháp`, `Đang chạy`, `Tạm dừng`, `Đã kết thúc`, `Đã lưu trữ`.
- Số khách, số lượt còn lại, số giải còn lại.
- Nút **Tiếp tục thiết lập**, **Tạm dừng**, **Kết thúc** tùy trạng thái.

Nếu chưa chọn sự kiện, các trang thao tác phải hiển thị màn hình chọn sự kiện thay vì gọi API không có campaign context.

### 4.2. Menu mặc định cho người vận hành

1. **Tổng quan sự kiện**
2. **Thiết lập sự kiện**
3. **Khách tham gia**
4. **Phát thưởng**
5. **Kiểm tra và kích hoạt**
6. **Kết quả / Kho Voucher**

Các màn hình kỹ thuật như danh mục rule chi tiết, assignment trực tiếp, endpoint debug hoặc cấu hình nâng cao không nằm trong menu chính. Admin có quyền mở chúng từ nút **Nâng cao**.

## 5. Luồng wizard vận hành

### Bước 1 — Chọn hoặc tạo sự kiện

Màn hình cung cấp hai lựa chọn:

- **Tạo sự kiện mới**: mã, tên, thời gian, múi giờ.
- **Dùng lại sự kiện cũ**: nhân bản `Chỉ cấu hình` hoặc `Cấu hình + danh sách khách`.

Mặc định sự kiện mới ở trạng thái `Nháp`. Chỉ sự kiện `Đang chạy` mới nhận lượt quay. Database tiếp tục bảo đảm chỉ có một sự kiện active.

Checklist trước khi đi tiếp:

- Tên và mã hợp lệ.
- Thời gian kết thúc sau thời gian bắt đầu.
- Người vận hành biết sự kiện này sẽ thay thế hay chạy sau sự kiện hiện tại.

### Bước 2 — Thêm khách tham gia

Có hai cách:

- Chọn khách đã có trong hệ thống.
- Import Excel/CSV.

Mẫu import hỗ trợ:

| Cột | Bắt buộc | Ý nghĩa |
|---|---:|---|
| `Tên KH` | Có | Tên khách |
| `SĐT` | Có | Số điện thoại đã chuẩn hoá |
| `Số voucher tặng` | Có | Số voucher hoặc số lượt tùy chế độ |
| `Ghi chú` | Không | Ghi chú sự kiện; trong chế độ voucher có thể chứa mệnh giá |
| `Mã Voucher` | Không | Mã voucher có sẵn nếu doanh nghiệp cung cấp |
| `Nhóm khách` | Không | Tên group riêng, chỉ xử lý khi cột này được khai báo |

Luồng import:

1. Chọn file.
2. Tự nhận diện cột hoặc cho phép map cột.
3. Hiển thị preview 20 dòng đầu.
4. Báo số dòng hợp lệ, lỗi, trùng số điện thoại, trùng voucher.
5. Cho tải danh sách lỗi.
6. Chỉ ghi dữ liệu sau khi Admin bấm **Xác nhận import**.

Không được import một phần khi có lỗi validation nghiêm trọng.

### Bước 3 — Chọn mô hình phát thưởng

Đây là bước quan trọng nhất để loại bỏ nhầm lẫn.

#### Mô hình A: Voucher cấp sẵn

Dùng khi file đã chỉ định mỗi khách nhận voucher nào.

UI phải hiển thị rõ:

> Mỗi lượt quay sẽ lấy voucher đã cấp cho khách theo thứ tự. Không tạo rule Default cho nhóm khách này nếu muốn giữ voucher cố định.

Kiểm tra bắt buộc:

- Số lượt quota bằng số voucher cần nhận.
- Mỗi mệnh giá tìm được giải tương ứng trong sự kiện.
- Nếu thiếu mã voucher và không match được giải, phải chặn xác nhận.
- Không tự dùng cột `Ghi chú` làm tên group.

#### Mô hình B: Quay ngẫu nhiên

Dùng khi khách chỉ có quota quay, còn giải do rule quyết định.

UI hướng dẫn:

> Hệ thống sẽ xét rule, tỷ lệ thắng và tồn kho. File không cấp voucher cố định cho từng khách.

Thiết lập tối thiểu:

- Lượt quay.
- Tỷ lệ thắng.
- Giải thưởng.
- Số lượng giải.
- Giới hạn số lần thắng mỗi khách.

#### Mô hình C: Nhóm đặc biệt

Dùng khi khách VIP/đại lý/nhân viên có luật riêng.

Luồng:

1. Chọn hoặc tạo group.
2. Thêm thành viên.
3. Tạo rule cho group.
4. Gán rule vào group.
5. Xem preview so sánh group đặc biệt với khách thường.

## 6. Rule Builder đơn giản

### 6.1. Trường hiển thị mặc định

Thay vì bắt nhập nhiều trường kỹ thuật, form chính hiển thị:

- **Áp dụng cho:** Tất cả khách / Nhóm khách / Khách cụ thể.
- **Lượt quay:** 1, 2, 3…
- **Cơ hội trúng:** 0–100%.
- **Giải thưởng:** chọn từ danh mục.
- **Số lượng giải:** số lượng tối đa.
- **Mỗi khách được trúng tối đa:** số lần.
- **Đang áp dụng:** bật/tắt.

Sau khi nhập, hiển thị câu tóm tắt tự nhiên, ví dụ:

> Lượt 1: khách VIP có 100% cơ hội nhận Voucher mua hàng 10.000.000đ, tối đa 1 lần. Tồn kho còn 1.

### 6.2. Trường nâng cao

Đặt trong accordion **Cài đặt nâng cao**:

- Mã rule.
- Độ ưu tiên.
- Tỷ lệ từng giải khi có nhiều giải.
- Thời gian bắt đầu/kết thúc rule.
- Giới hạn theo từng rule.
- Điều kiện OA.
- `allow_unlisted`, `allow_refollow`, `special_conditions` nếu đã được backend hỗ trợ đầy đủ.

Các trường chưa được backend thực thi phải có nhãn **Chưa khả dụng** hoặc bị vô hiệu hóa, không được hiển thị như đã hoạt động.

### 6.3. Cảnh báo rule

Trước khi lưu hoặc kích hoạt, UI phải kiểm tra:

- Rule không thuộc sự kiện đang chọn.
- Rule chỉ có cấu hình lượt 1 nhưng khách đã dùng lượt 1.
- Bật `Bắt buộc theo dõi OA` trong khi backend chưa có xác minh OA.
- Rule Default đang áp dụng cho khách có voucher cấp sẵn.
- Tồn kho thấp hơn số lượng thắng dự kiến.
- Hai rule cùng đối tượng/lượt có độ ưu tiên gây khó hiểu.
- `Số lượng quà = 0` hoặc giải đã tắt.
- Đặt `Tỷ lệ thắng = 100%` nhưng tồn kho không đủ.

Cảnh báo phải nói bằng nghiệp vụ, ví dụ:

> Rule này sẽ ghi đè voucher cấp sẵn của 128 khách trong sự kiện. Bạn có muốn tiếp tục không?

## 7. Bước kiểm tra trước khi kích hoạt

Trang **Kiểm tra và kích hoạt** hiển thị checklist:

- Có sự kiện được chọn.
- Sự kiện có khách active.
- Mỗi khách có quota hợp lệ.
- Có ít nhất một mô hình phát thưởng hợp lệ.
- Giải thưởng đang bật.
- Tồn kho không âm.
- Không có dòng import lỗi chưa xử lý.
- Rule có campaign đúng.
- OA rule không bật khi tích hợp chưa sẵn sàng.
- Có thể tạo kết quả thử cho khách test.

### Chế độ quay thử

Nút **Quay thử** phải dùng khách test hoặc chế độ dry-run, không trừ quota, không trừ tồn kho, không tạo award thật và không gửi Google Sheets/Zalo.

Kết quả thử cần hiển thị:

- Rule được chọn.
- Lý do rule được chọn.
- Tỷ lệ thắng.
- Giải dự kiến.
- Tồn kho sau khi quay thật.
- Nếu không trúng, lý do là OA, quota, giới hạn, tỷ lệ hoặc hết kho.

Chỉ khi checklist đạt mới bật nút **Kích hoạt sự kiện**.

## 8. Dashboard sau khi chạy

Dashboard của một sự kiện hiển thị:

- Tổng khách.
- Tổng lượt được cấp, đã dùng, còn lại.
- Số lượt trúng và không trúng.
- Số voucher đã cấp, đã giao, đã đổi, hết hạn, huỷ.
- Tồn kho theo từng giải.
- Khách gần hết lượt.
- Rule đang được dùng nhiều nhất.
- Lỗi đồng bộ Google Sheets hoặc gửi thông báo.

Các nút chính:

- **Tạm dừng sự kiện**.
- **Kết thúc sự kiện**.
- **Xuất báo cáo**.
- **Mở Kho Voucher**.
- **Nhân bản cấu hình cho sự kiện mới**.

## 9. Quy tắc an toàn vận hành

- Không cho xoá dữ liệu lịch sử từ giao diện chính.
- Sự kiện đã có lượt quay không được sửa các trường làm thay đổi lịch sử mà không tạm dừng.
- Sửa rule đang chạy phải cảnh báo việc tồn kho có thể bị thay đổi; tốt nhất tạo rule mới hoặc nhân bản sự kiện.
- Khi sự kiện đã active, không cho thay đổi mã sự kiện.
- Tất cả hành động nguy hiểm cần confirm và hiển thị đối tượng bị ảnh hưởng.
- Số điện thoại hiển thị dạng che một phần ở danh sách; chỉ hiện đầy đủ ở màn hình được phép.
- Google Sheets chỉ là nơi báo cáo, database mới là nguồn dữ liệu chính.
- Kết thúc sự kiện phải là thao tác rõ ràng; không chỉ dựa vào ngày kết thúc hiển thị.

## 10. Phân quyền hiển thị

Trong phạm vi mini app hiện tại chỉ có một Admin, nhưng UI vẫn nên chia:

- **Vận hành:** dùng wizard, import, kiểm tra, kích hoạt, xem báo cáo.
- **Nâng cao:** quản lý rule kỹ thuật, assignment trực tiếp, sửa cấu hình sâu.

Không cần xây hệ thống nhiều tài khoản hoặc phê duyệt trong giai đoạn này.

## 11. Kiến trúc triển khai đề xuất

Không cần viết lại toàn bộ Admin Web. Tách dần `admin-web/src/App.jsx` thành các feature:

```text
admin-web/src/features/operator/
  EventWorkspace.jsx
  EventWizard.jsx
  AudienceImportStep.jsx
  RewardModeStep.jsx
  RuleBuilderStep.jsx
  LaunchChecklist.jsx
  EventDashboard.jsx
  operator-api.js
```

Các feature dùng lại API backend hiện có:

- `/admin/campaigns`
- `/admin/campaigns/:id/clone`
- `/admin/campaigns/:id/participants`
- `/admin/campaign-rules`
- `/admin/groups`
- `/admin/awards`
- `/admin/campaigns/:id/export`

API bổ sung nên có:

- `GET /admin/campaigns/:id/readiness`: checklist trước khi chạy.
- `POST /admin/campaigns/:id/dry-run-spin`: mô phỏng không ghi dữ liệu.
- `GET /admin/campaigns/:id/summary`: dashboard tổng hợp.
- `GET /admin/campaigns/:id/rule-preview`: giải thích rule được chọn cho một khách/lượt.

Không để frontend gọi Supabase trực tiếp.

## 12. Kế hoạch triển khai theo giai đoạn

### Giai đoạn A — Làm rõ context

- Thanh chọn sự kiện dùng chung.
- Đổi menu chính theo 6 bước vận hành.
- Hiển thị trạng thái và cảnh báo sự kiện.

### Giai đoạn B — Wizard import và mô hình phát thưởng

- Import preview/validation/confirm.
- Chọn voucher cấp sẵn hoặc quay ngẫu nhiên.
- Cảnh báo xung đột giữa file voucher và rule Default.

### Giai đoạn C — Rule Builder và readiness

- Form ngôn ngữ tự nhiên.
- Ẩn trường kỹ thuật vào Advanced.
- Checklist và cảnh báo rule.
- Dry-run không làm thay đổi dữ liệu thật.

### Giai đoạn D — Dashboard vận hành

- Summary theo campaign.
- Tồn kho và award status.
- Báo cáo CSV/Google Sheets.
- Luồng pause/end/clone an toàn.

## 13. Kiểm thử và nghiệm thu

### Test chức năng

- Người mới có thể tạo sự kiện mà không nhập mã rule thủ công.
- Import file lỗi không ghi dữ liệu một phần.
- Chế độ voucher cấp sẵn không tự tạo rule Default.
- Chế độ quay ngẫu nhiên bắt buộc có rule và tồn kho hợp lệ.
- Group rule chỉ tác động thành viên group.
- Cảnh báo xuất hiện khi bật OA nhưng backend chưa xác minh OA.
- Dry-run không trừ quota, tồn kho, award hoặc Google Sheets.
- Chỉ sự kiện active mới cho quay.
- Chỉ có một sự kiện active.
- Kết thúc sự kiện không xoá lịch sử.

### Tiêu chí nghiệm thu UX

- Nhân viên vận hành có thể hoàn tất một sự kiện bằng tối đa 5 bước chính.
- Không cần hiểu `campaign_id`, `rule_id` hoặc SQL.
- Mọi trang đều biết đang thao tác trên sự kiện nào.
- Trước khi kích hoạt, hệ thống giải thích rõ khách sẽ nhận giải theo cách nào.
- Các lỗi cấu hình phổ biến được phát hiện trước khi chạy thật.
- Người vận hành biết phải làm gì tiếp theo sau mỗi lỗi.
- Build và test backend, Mini App, Admin Web đều pass.

## 14. Không thuộc phạm vi giai đoạn này

- Nhiều Admin hoặc phân quyền phức tạp.
- Chạy song song nhiều sự kiện.
- Tự động tạo chiến lược khuyến mãi bằng AI.
- Tự động thay đổi tỷ lệ khi đang chạy mà không có người duyệt.
- Thay đổi giao diện Mini App công khai ngoài phần cần thiết cho campaign context.
