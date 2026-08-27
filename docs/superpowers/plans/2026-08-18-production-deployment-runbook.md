# Kế hoạch Triển khai Production (Production Deployment Runbook)

> **Dành cho Agent/Developer:** Kỹ năng bắt buộc: Sử dụng quy trình phát triển theo từng Task. Các bước sử dụng cú pháp ô chọn (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Chuyển đổi ứng dụng Vòng Quay Luckys (Lucky Wheels) từ môi trường local/staging sang bản phát hành Production chính thức, có kiểm soát với xác thực Zalo hoàn chỉnh, tính toàn vẹn dữ liệu trên Supabase, tự động gửi Voucher qua ZBS, báo cáo Google Sheets và quy trình kích hoạt/đảo ngược an toàn.

**Kiến trúc:** Triển khai 3 bề mặt ứng dụng riêng biệt: Zalo Mini App, Public HTTPS Express API và Admin Web. Chạy worker gửi tin nhắn (Delivery Worker) dưới dạng tiến trình Backend thứ hai chạy ngầm. Supabase là cơ sở dữ liệu gốc (System of Record); Backend API nắm giữ các secret và quyết định logic nghiệp vụ; Zalo và ZBS là các tích hợp bên ngoài; Google Sheets chỉ đóng vai trò ghi log báo cáo.

**Công nghệ sử dụng:** Zalo Mini App SDK, React/Vite, Admin React/Vite, Node.js 22+, Express, Supabase Postgres/Auth/Storage, ZBS WIFIM API, Google Apps Script webhook, GitHub Actions.

**Tài liệu tham chiếu:** `KIEN_TRUC_DANH_GIA.md`, `docs/superpowers/plans/2026-08-16-giai-doan-1-production-safety.md`, `docs/superpowers/plans/2026-08-17-wheel-data-loading-performance-plan.md`, và `lucky-wheels/supabase/README.md`.

## Các Ràng buộc Bắt buộc (Global Constraints)

- Môi trường Production bắt buộc phải cấu hình: `APP_ENV=production`, `PARTICIPANT_AUTH_MODE=zalo`, và `ADMIN_AUTH_MODE=supabase`.
- `SUPABASE_SERVICE_ROLE_KEY`, `ZALO_APP_SECRET`, `ZBS_API_KEY`, và các webhook secret chỉ được lưu trữ trong kho lưu trữ secret của Backend/Worker.
- Các biến `VITE_*` là cấu hình công khai lúc build; tuyệt đối không đưa service-role key, Zalo App Secret, ZBS key, hoặc mật khẩu admin vào biến môi trường của Mini App / Admin Web.
- Áp dụng migration vào dự án Supabase Test riêng biệt trước. Không bao giờ reset database Production hoặc chỉnh sửa trực tiếp migration đã chạy.
- Bảo tồn lịch sử dữ liệu khách hàng, lượt quay, giải thưởng, lịch sử gửi ZNS, dữ liệu sự kiện và kho voucher. Quy trình rollback chỉ thực hiện bằng các migration sửa đổi tiến lên (forward-only) hoặc rollback bản build ứng dụng; tuyệt đối không xóa dữ liệu lịch sử.
- Việc phát hành Production sẽ bị CHẶN nếu tìm theo SĐT preview, xác thực Admin development, điều kiện Zalo OA chưa được kiểm tra, hoặc thiếu ZBS credentials khi chạy sự kiện thật.
- Chạy API và Delivery Worker dưới dạng các tiến trình riêng biệt có cơ chế tự động khởi động lại, HTTPS, ghi log và health check.
- Google Sheets chỉ là kênh báo cáo phụ (non-authoritative). Lỗi nảy sinh tại Google Sheets không được phép hủy bỏ lượt quay hoặc giải thưởng voucher đã ghi nhận thành công trong DB.

---

## Các Điểm Nghẽn Hiện tại (Blockers) Tìm thấy trong Kiểm tra

Cần giải quyết các điều kiện sau trước khi bấm nút Go-Live:

- Backend local hiện đang đặt `APP_ENV=development` và `PARTICIPANT_AUTH_MODE=preview`.
- URL API của Mini App và Admin local đang trỏ về `localhost`.
- `ZALO_APP_SECRET` đang để trống; cấu hình production sẽ từ chối khởi động nếu thiếu secret này.
- `ZBS_API_KEY` và `ZBS_TEMPLATE_ID` đang để trống, khiến tính năng gửi voucher ZNS chưa kích hoạt.
- Việc chạy integration test database hiện báo bỏ qua 2 bước kiểm tra do project test thiếu migration `0006` và `0007`.
- Thư mục migration đã có từ `0001` đến `0011`, nhưng lệnh `test:db` trong `backend/package.json` chưa bao gồm kiểm tra cho `0010` và `0011`.
- Router quay thưởng công khai hiện truyền `oaFollowed: false` cho đến khi có adapter xác thực OA từ server. Các luật yêu cầu OA không được bật ở Production trước khi adapter này được kiểm tra thành công.
- Endpoint Google Sheets Apps Script hiện đang mở công khai và cần thêm cơ chế xác thực request trước khi đưa vào dùng thật.
- Repository đã có CI nhưng chưa commit file cấu hình hosting Production. Cần chốt hạ dịch vụ hosting và tên miền trước khi triển khai.

---

## Sơ đồ File và Hệ thống

- Chỉnh sửa: `backend/package.json` — bao gồm toàn bộ kiểm tra migration integration test trong `test:db`.
- Chỉnh sửa: `backend/test/db/` — thêm runtime check cho `0010_unlisted_customer_access.sql` và `0011_make_spin_event_id_nullable.sql`.
- Chỉnh sửa: `backend/src/config.js` và `backend/src/google-sheets-service.js` — thêm secret xác thực Sheets webhook phía backend nếu vẫn bật đồng bộ Sheets.
- Chỉnh sửa: `docs/google-sheets-webhook-doPost.gs` — xác thực shared webhook secret trước khi ghi dòng mới vào Sheet.
- Chỉnh sửa: `backend/README.md`, `lucky-wheels/README.md`, `lucky-wheels/supabase/README.md` — ghi rõ thứ tự migration cuối cùng, danh sách biến production, worker và bài test kiểm tra nhanh (smoke test).
- Tùy chọn tạo: File cấu hình deployment cho Node host và Static host; không commit giá trị secret.
- Bên ngoài: Supabase project Production, tài khoản Supabase Auth admin, cấu hình Zalo Developer, tài khoản/template ZBS, Google Sheet/Apps Script deployment, API host, worker host, Admin Web host.

---

## Giai đoạn 0: Đóng đóng băng & Đóng gói (Freeze and Back Up)

### Task 0.1: Đóng băng bản phát hành

- [ ] Xác nhận commit và branch phát hành trên GitHub.
- [ ] Xác nhận `git status --short` trống và `git diff --check` không ra kết quả nào.
- [ ] Đóng tag (Git Tag) cho commit phát hành chính xác sau khi sửa hết lỗi, ví dụ: `production-candidate-YYYYMMDD`.
- [ ] Ghi lại phiên bản Mini App, commit API, hash bản build Admin Web, danh sách migration và checksum cấu hình vào bản ghi phát hành. Tuyệt đối không ghi lại các giá trị secret.

### Task 0.2: Sao lưu dữ liệu Production

- [ ] Kích hoạt/xác nhận tính năng tự động backup và PITR (Point-In-Time Recovery) của Supabase cho project Production.
- [ ] Xuất bản sao lưu mã hóa riêng cho các bảng: `customers`, `customer_rewards`, `campaigns`, `campaign_participants`, `reward_catalog`, `spin_events`, `awards`, `deliveries`, `rules`, và `rule_spin_configs`.
- [ ] Lưu trữ file backup bên ngoài repository và kiểm tra đảm bảo người phụ trách có thể tải về được.
- [ ] Ghi lại mốc thời gian backup và thời hạn lưu giữ trước khi chạy bất kỳ migration nào trên Production.

---

## Giai đoạn 1: Chuẩn bị Repository sẵn sàng cho Production

### Task 1.1: Hoàn thiện Integration Test cho các Migration

**Các file liên quan:**
- Chỉnh sửa: `backend/package.json`
- Tạo/chỉnh sửa: `backend/test/db/phase2h.integration.test.js` và `backend/test/db/phase2i.integration.test.js` (hoặc tên tương đương khớp với phiên bản migration)
- Chỉnh sửa: `lucky-wheels/supabase/README.md`

- [ ] Bổ sung `0010_unlisted_customer_access.sql` và `0011_make_spin_event_id_nullable.sql` vào lệnh `test:db`.
- [ ] Thêm contract test kiểm tra `0010` tạo/lưu giữ đúng các cột `allow_unlisted`, `unlisted_spin_quota`, và nguồn đăng ký khách hàng.
- [ ] Thêm contract test kiểm tra `0011` làm cho `public.deliveries.spin_event_id` cho phép nhận giá trị `NULL` mà không làm mất dữ liệu hiện có hoặc vi phạm ràng buộc khác.
- [ ] Chạy lần lượt các migration từ `0001` đến `0011` trên project test riêng biệt theo đúng thứ tự số.
- [ ] Chạy `npm --prefix backend run test:db` đảm bảo 100% pass, 0 lỗi, 0 bị bỏ qua (skip).
- [ ] Chạy `npm --prefix backend test` đảm bảo không có lỗi nào.
- [ ] Cập nhật tài liệu README để danh sách migration có đủ 11 file và ghi rõ lệnh nào dùng cho môi trường nào.
- [ ] Commit các thay đổi về script test migration và tài liệu riêng biệt với các thay đổi deployment.

### Task 1.2: Kiểm tra Ranh giới Bảo mật (Security Boundaries)

- [ ] Chạy kiểm tra cấu hình production với `APP_ENV=production`, `PARTICIPANT_AUTH_MODE=zalo`, và không có Zalo secret; xác nhận hệ thống từ chối khởi động. Sau đó thử lại với test secret; xác nhận cấu hình hợp lệ.
- [ ] Xác nhận các endpoint tạo session preview bị từ chối hoàn toàn ngoài môi trường development.
- [ ] Xác nhận Admin Web chỉ có thể đăng nhập bằng Supabase Auth ở Production; nhánh token dev không thể truy cập khi `ADMIN_AUTH_MODE=supabase`.
- [ ] Xác nhận các API `/participant/me`, `/participant/me/awards`, `/participant/me/spins`, `/spins`, và `/delivery/zbs` bắt buộc phải có participant token do server cấp.
- [ ] Xác nhận danh tính người quay, số lượt quay, giải thưởng, tồn kho và thông tin voucher được tính toán hoàn toàn ở phía Server; Client không được tự gửi `customerId` hoặc thông tin quà tặng trong lượt quay/gửi tin thật.
- [ ] Xác nhận không có file `.env`, service-role key, App Secret, ZBS key, mật khẩu admin, hoặc URL chứa credential bị commit vào git: `git ls-files | Select-String '\\.env$|service.role|app.secret|zbs.key'`.

### Task 1.3: Khắc phục điểm nghẽn Zalo OA và Google Sheets

- [ ] Chốt phương án vận hành: Hoặc tắt tất cả các quy định "bắt buộc theo dõi OA" trong đợt chạy đầu tiên, hoặc hoàn thiện và kiểm tra adapter xác thực Zalo OA phía server để truyền kết quả boolean vào `spin_once`.
- [ ] Không phụ thuộc vào `sessionStorage` hoặc việc thiếu `VITE_ZALO_OA_ID` để xác định trạng thái theo dõi OA.
- [ ] Thêm cấu hình backend-only `GOOGLE_SHEETS_WEBHOOK_SECRET` và truyền trong header `X-Webhook-Secret`.
- [ ] Cập nhật `docs/google-sheets-webhook-doPost.gs` để từ chối các request không có secret hợp lệ trước khi xử lý dữ liệu.
- [ ] Triển khai lại Apps Script web app và kiểm tra request POST không có secret bị từ chối, còn POST có secret được ghi đúng 1 dòng vào Sheet.
- [ ] Giữ cho việc đồng bộ Google Sheets chạy bất đồng bộ; xác nhận khi webhook Sheets lỗi thì lượt quay và giải thưởng trong DB vẫn ghi nhận thành công.

### Task 1.4: Chạy Kiểm tra Phát hành tại Local

```powershell
npm ci --prefix backend
npm ci --prefix lucky-wheels
npm ci --prefix admin-web
npm test
npm run build
git diff --check
```

- [ ] Đảm bảo tất cả các bài test đều pass và cả 2 bản build Vite đều kết thúc với mã lỗi 0.
- [ ] Xem lại cảnh báo dung lượng bundle Admin Web (hiện > 500 KB). Đây không phải điểm chặn go-live với sự kiện nhỏ, nhưng cần ghi lại để tối ưu split code sau.
- [ ] Xác nhận bản sửa lỗi hiệu năng vòng quay đã có mặt: cache session response, chống trùng lặp request đang xử lý, và không bị trắng vòng quay khi đang tải.

---

## Giai đoạn 2: Khởi tạo Supabase Production

### Task 2.1: Tạo/Xác nhận Project Production

- [ ] Sử dụng một project Supabase Production hoàn toàn riêng biệt với project test.
- [ ] Bật tính năng backup database, khôi phục PITR (nếu có), Auth email/password, và Storage.
- [ ] Ghi lại URL project Production và Anon Key vào bộ quản lý secret; tuyệt đối không đưa Service-Role Key vào cấu hình Frontend.
- [ ] Tạo bucket `campaign-assets` để lưu ảnh Banner từ trang Admin và cài đặt chính sách truy cập public/private trước khi dùng.

### Task 2.2: Chạy và Kiểm tra Migration

Chạy các file sau đúng 1 lần, theo đúng thứ tự, trên project test trước, sau đó mới chạy trên Production khi bài test pass:

```text
0001_lucky_wheels.sql
0002_phase1_production_safety.sql
0003_campaign_foundation.sql
0004_awards_vouchers_foundation.sql
0005_award_creation_spin_once.sql
0006_campaign_control.sql
0007_campaign_participants.sql
0008_campaign_spin_isolation.sql
0009_award_status_audit.sql
0010_unlisted_customer_access.sql
0011_make_spin_event_id_nullable.sql
```

- [ ] Kiểm tra từng table, index, RLS policy, function, trigger, và RPC tồn tại đầy đủ sau khi chạy xong migration cuối cùng.
- [ ] Xác nhận `spin_once` là hàm production được gọi bởi API quay thưởng công khai.
- [ ] Xác nhận dữ liệu lịch sử khách hàng, quà tặng, lượt quay, giải thưởng và bản ghi gửi tin vẫn giữ nguyên sau migration.
- [ ] Xác nhận chỉ có tối đa 1 sự kiện ở trạng thái `active` và khung thời gian/múi giờ sự kiện đã chính xác.
- [ ] Xác nhận khách hàng không có trong sự kiện sẽ không thể quay nếu chính sách sự kiện yêu cầu đăng ký trước.
- [ ] Kiểm tra tính năng truy cập/lượt quay của khách vãng lai (unlisted) trên môi trường test trước khi bật cho sự kiện thật.

### Task 2.3: Tạo Tài khoản Admin Production

- [ ] Tạo tài khoản vận hành trong Supabase Auth.
- [ ] Đọc UUID thực tế của user từ Supabase Auth; không chèn chuỗi giả lập `UUID_CUA_USER`.
- [ ] Chèn UUID lấy được từ bảng Auth Users vào `public.admin_profiles (user_id, role)` với quyến `admin`.
- [ ] Đăng nhập qua Admin Web đã deploy và kiểm tra `/api/v1/admin/auth/me` trả về đúng quyền admin.
- [ ] Xóa toàn bộ credential admin tạm thời ở local khỏi kho lưu trữ secret.

---

## Giai đoạn 3: Cấu hình các Dịch vụ Bên ngoài

### Task 3.1: Cấu hình Zalo Developer

- [ ] Xác nhận App ID Production của Mini App và tài khoản sở hữu.
- [ ] Yêu cầu/xác nhận quyền lấy số điện thoại `scope.userPhonenumber` cho Mini App Production.
- [ ] Lấy App Secret Production và chỉ lưu trữ dưới dạng `ZALO_APP_SECRET` trên Backend.
- [ ] Giữ `ZALO_GRAPH_BASE_URL=https://graph.zalo.me` trừ khi Zalo cung cấp endpoint production khác.
- [ ] Cấu hình OA ID Production vào Mini App dưới dạng `VITE_ZALO_OA_ID` và kiểm tra widget OA trên ứng dụng Zalo thật.
- [ ] Test các trường hợp: đồng ý cấp SĐT, từ chối, token hết hạn, và token lỗi format. Không lưu token SĐT thô của Zalo vào DB hoặc log.
- [ ] Gửi duyệt và xuất bản phiên bản Mini App qua quy trình xét duyệt của Zalo trước khi truyền thông sự kiện.

### Task 3.2: Cấu hình ZBS WIFIM (Gửi ZNS)

Hệ thống sử dụng API gửi tin đơn lẻ: `POST https://zbs.wifim.vn/api/v1/send` với `X-API-Key`, `phone`, `template_id`, và `template_data`. Xem thêm tại [Tài liệu API ZBS](https://zbs.wifim.vn/docs/api).

- [ ] Lấy API Key ZBS Production; chỉ lưu dưới dạng `ZBS_API_KEY` trên Backend/Worker.
- [ ] Tạo/duyệt Mẫu ZNS Production và ghi lại chính xác `template_id` cùng tên các tham số.
- [ ] Xác nhận Mẫu ZNS có đủ các trường Backend sẽ gửi: `customer_name`, `voucher_name`, `voucher_code`, `voucher_value`, và `expiry_date`.
- [ ] Cấu hình `ZBS_TEMPLATE_ID` và `ZBS_API_BASE_URL=https://zbs.wifim.vn/api` trong kho secret Backend/Worker.
- [ ] Sử dụng API Admin đã xác thực để tra cứu template; tuyệt đối không lộ ZBS key ra Mini App.
- [ ] Gửi thử 1 tin nhắn test đến SĐT nội bộ và kiểm tra phản hồi ZBS có `success: true` và `msg_id`.
- [ ] Xác nhận hạn mức ZBS, ủy quyền OA, trạng thái template và sự đồng ý nhận tin của khách hàng trong suốt thời gian diễn ra sự kiện.
- [ ] Triển khai Delivery Worker riêng biệt với `WORKER_ID` duy nhất và cơ chế tự động khởi động lại.
- [ ] Kiểm tra trạng thái gửi tin chuyển mượt từ `pending → processing → sent` và giải thưởng tương ứng chuyển sang `delivered`.
- [ ] Kiểm tra khi nhà cung cấp lỗi, hệ thống sẽ tự động thử lại (retry backoff) và không gửi trùng lặp khi worker restart.
- [ ] Không bật sự kiện chạy thật cho đến khi tin nhắn test kiểm soát gửi thành công.

### Task 3.3: Báo cáo Google Sheets

- [ ] Xác nhận File Google Sheet và Tab nhận dữ liệu thuộc sở hữu của người vận hành sự kiện.
- [ ] Triển khai phiên bản Apps Script mới nhất hỗ trợ đầy đủ các cột bao gồm thông tin sự kiện và giải thưởng.
- [ ] Cấu hình URL Webhook Backend và Shared Secret vào bộ quản lý secret.
- [ ] Gửi dữ liệu test và kiểm tra font chữ Tiếng Việt UTF-8, định dạng SĐT, mã voucher, trạng thái, sự kiện và thời gian.
- [ ] Xác nhận việc gửi trùng lượt quay cùng `spinId` không bị ghi thêm dòng thứ 2 vào Sheet.

---

## Giai đoạn 4: Triển khai Ứng dụng (Deploy Runtime)

### Task 4.1: Dịch vụ Backend API

Triển khai dịch vụ Node.js 22+ HTTPS với:

- Lệnh chạy: `npm --prefix backend start`.
- Endpoint Health check: `GET /health`.
- Cơ chế tự động khởi động lại và sẵn sàng 1 bản release trước đó để rollback khi cần.
- HTTPS/TLS, ghi log request/response không chứa SĐT hay secret, và giám sát uptime.
- Giới hạn dung lượng request body và cấu hình CORS chỉ cho phép origin Admin Web và các domain ứng dụng được duyệt.

Cấu hình các biến môi trường Production sau trên host. Nguồn giá trị và kiểm tra được quy định rõ ràng:

| Biến môi trường | Nguồn giá trị | Kiểm tra bắt buộc |
|---|---|---|
| `APP_ENV` | Cài đặt cố định | Bắt buộc là `production` |
| `PARTICIPANT_AUTH_MODE` | Cài đặt cố định | Bắt buộc là `zalo` |
| `ADMIN_AUTH_MODE` | Cài đặt cố định | Bắt buộc là `supabase` |
| `PARTICIPANT_SESSION_TTL_SECONDS` | Chính sách phát hành | Số nguyên dương; mặc định 1800 giây |
| `SUPABASE_URL` | Cấu hình Supabase Production | HTTPS URL của project Production; không dùng URL project test |
| `SUPABASE_SERVICE_ROLE_KEY` | Cấu hình API Supabase Production | Chỉ có trên kho secret của Backend/Worker |
| `SUPABASE_ANON_KEY` | Cấu hình API Supabase Production | Có mặt; tuyệt đối không thay thế bằng Service-Role Key |
| `ZALO_APP_SECRET` | App Secret Production Zalo Developer | Chỉ có trên kho secret của Backend/Worker |
| `ZALO_GRAPH_BASE_URL` | Zalo Production API | `https://graph.zalo.me` |
| `ZBS_API_BASE_URL` | Tài liệu ZBS API | `https://zbs.wifim.vn/api` |
| `ZBS_API_KEY` | Dashboard ZBS API Key | Chỉ có trên kho secret của Backend/Worker |
| `ZBS_TEMPLATE_ID` | ID Mẫu ZNS đã duyệt | Khớp với template_id đã kiểm tra qua Admin |
| `WORKER_ID` | Định danh instance | Duy nhất cho mỗi tiến trình worker chạy ngầm |
| `CORS_ORIGINS` | Danh sách domain Admin Web | Chỉ dùng HTTPS origin; không dùng localhost ở Production |
| `GOOGLE_SHEETS_WEBHOOK_URL` | URL Apps Script Web App | HTTPS URL của bản triển khai script hiện tại |
| `GOOGLE_SHEETS_WEBHOOK_SECRET` | Secret tự tạo cho tích hợp này | Khớp giữa Apps Script và Backend; không ghi ra log |

Tuyệt đối không đặt `PARTICIPANT_AUTH_MODE=preview`, `ADMIN_AUTH_MODE=development`, hoặc `DEV_AUTH_SECRET` cho dịch vụ Production này.

### Task 4.2: Delivery Worker (Tiến trình gửi ZNS ngầm)

Triển khai tiến trình Node.js 22+ thứ 2 sử dụng cùng mã nguồn backend và secret DB/ZBS:

```powershell
npm --prefix backend run worker:delivery
```

- [ ] Đặt `WORKER_ID` duy nhất cho mỗi tiến trình worker.
- [ ] Cấu hình `DELIVERY_POLL_MS`, `DELIVERY_BATCH_SIZE`, và `DELIVERY_MAX_ATTEMPTS` theo thông số đã test ở staging.
- [ ] Bật cơ chế tự động khởi động lại và xử lý tín hiệu dừng an toàn (graceful SIGTERM).
- [ ] Xác nhận chỉ có Worker (không phải Browser client) thực hiện gọi API gửi ZBS.
- [ ] Cài đặt cảnh báo khi số lượng bản ghi tin nhắn chờ/đang xử lý vượt quá ngưỡng cho phép.

### Task 4.3: Admin Web

- [ ] Build ứng dụng: `npm ci --prefix admin-web` và `npm --prefix admin-web run build`.
- [ ] Đặt `VITE_API_BASE_URL` trỏ về HTTPS API Backend Production, kết thúc bằng `/api/v1`.
- [ ] Serve thư mục `admin-web/dist` từ HTTPS static host với cấu hình SPA fallback về `index.html`.
- [ ] Không để lộ các biến service-role, Zalo, ZBS, hay mật khẩu admin trong bản build Admin Web.
- [ ] Kiểm tra đăng nhập Supabase Auth, phân quyền admin profile, chọn sự kiện, import khách hàng, lưu luật quay, chạy thử (dry-run), vận hành kho voucher và xuất file CSV.

### Task 4.4: Zalo Mini App

- [ ] Đặt `APP_ID` thành ID Mini App Production và thiết lập `ZMP_TOKEN` qua Zalo CLI credentials.
- [ ] Đặt `VITE_API_BASE_URL` trỏ về HTTPS API Backend Production và `VITE_PARTICIPANT_AUTH_MODE=zalo`.
- [ ] Đặt `VITE_ZALO_OA_ID` thành OA ID Production nếu quy trình yêu cầu theo dõi OA.
- [ ] Chạy `npm ci --prefix lucky-wheels` và `npm --prefix lucky-wheels run build`.
- [ ] Deploy bằng quy trình ZMP CLI đã xác thực và xuất bản phiên bản Production được duyệt.
- [ ] Kiểm tra màn hình vòng quay lần đầu hiển thị đúng các ô quà hoặc trạng thái đang tải, không bao giờ hiển thị vòng quay trống.

---

## Giai đoạn 5: Kiểm tra Nhanh trên Production (Smoke Test)

Thực hiện các bước kiểm tra theo thứ tự với tài khoản Zalo thử nghiệm nội bộ và một sự kiện test nhỏ. Không sử dụng quota của khách hàng thật trừ khi người vận hành đã phê duyệt.

- [ ] `GET /health` trả về HTTP `200` và `ok: true`.
- [ ] Đăng nhập Admin thành công với Supabase Auth và `/admin/auth/me` trả về đúng quyền admin.
- [ ] Admin thấy đúng 1 sự kiện `active` với ngày giờ/múi giờ chính xác.
- [ ] Admin import 1 khách hàng test và kiểm tra đúng số lượt quay được cấp.
- [ ] Một tài khoản Zalo thật bấm đồng ý cấp SĐT; backend tạo participant session thành công mà không để lộ token SĐT thô.
- [ ] Tài khoản Zalo từ chối cấp SĐT nhận được thông báo lỗi an toàn và không tạo session/khách hàng giả.
- [ ] Khách hàng vãng lai (unlisted) tuân thủ đúng chính sách: hoặc nhận đúng lượt quay thử hoặc bị từ chối an toàn.
- [ ] Mini App tải các ô vòng quay mượt mà, không bị trắng vòng quay, và khóa nút `QUAY` cho đến khi tải xong.
- [ ] Một lượt quay thành công sẽ tạo đúng: 1 dòng `spin_events`, 1 dòng giải thưởng (nếu trúng), 1 dòng delivery (nếu trúng quà cần gửi), và 1 dòng báo cáo trên Google Sheet.
- [ ] Thử lại cùng một request với cùng `idempotency key` sẽ trả về đúng kết quả cũ và không trừ thêm lượt quay.
- [ ] Hai request quay đồng thời từ cùng 1 tài khoản không thể vượt quá quota lượt quay hoặc tồn kho quà tặng.
- [ ] Khách hàng hết lượt quay nhận được lỗi HTTP `409` an toàn và không tạo thêm lượt quay mới.
- [ ] Voucher trúng thưởng được gửi đi bởi Worker (không phải Browser); trạng thái giải thưởng chuyển sang `delivered` chỉ sau khi ZBS báo thành công.
- [ ] Request gửi ZBS thất bại sẽ hiển thị đúng trong trạng thái delivery và được thử lại theo chính sách backoff.
- [ ] Admin có thể xem, gửi lại ZNS, xác nhận đổi thưởng, hủy/hết hạn voucher và xuất file CSV mà không làm sai lệch dữ liệu lịch sử.
- [ ] File CSV xuất ra hiển thị chuẩn font Tiếng Việt UTF-8 trên Excel / Google Sheets.
- [ ] Đóng sự kiện test hoặc dọn dẹp dữ liệu test theo quy trình dọn dẹp không phá hủy đã duyệt.

---

## Giai đoạn 6: Cổng Phê duyệt Go/No-Go

Bấm nút phát hành **GO** CHỈ KHI toàn bộ các ô chọn bên dưới được hoàn thành 100%:

- [ ] Đã xác nhận việc backup / PITR cho Supabase Production.
- [ ] Đã chạy và kiểm tra các migration từ `0001` đến `0011` trên cả môi trường test và Production.
- [ ] `npm test`, cả 2 lệnh build Vite, và `npm --prefix backend run test:db` đều pass 100% không có bài test nào bị skip.
- [ ] Cấu hình Production sử dụng Zalo Auth cho khách và Supabase Admin Auth cho Admin.
- [ ] Đã kiểm tra quyền lấy SĐT Zalo, App Secret, cấu hình OA, và adapter xác thực OA phía server.
- [ ] Đã kiểm tra Mẫu ZNS ZBS, API Key, gửi tin test thành công, và Delivery Worker ngầm.
- [ ] Google Sheets Webhook đã có xác thực secret và kiểm tra chuẩn UTF-8 / chống trùng lặp.
- [ ] Backend API, Delivery Worker, Admin Web, và Mini App đã được deploy qua HTTPS có giám sát uptime và tự động restart.
- [ ] Bài test Smoke test pass 100% cho khách trong danh sách, khách vãng lai, khách hết lượt, lượt quay trúng, lượt quay hụt, và request trùng lặp.
- [ ] Đã ghi lại thông tin người chịu trách nhiệm phát hành, người phụ trách rollback, liên hệ sự cố, thời gian bắt đầu/kết thúc sự kiện, và kênh nhận cảnh báo.

Nếu bất kỳ mục nào chưa hoàn thành, **GIỮ SỰ KIỆN Ở MÔ TRƯỜNG STAGING HOẶC TRẠNG THÁI DRAFT/PAUSED**.

---

## Quy trình Rollback và Xử lý Sự cố

1. Trên giao diện Admin, chuyển sự kiện sang trạng thái `paused` (Tạm dừng) để không nhận thêm lượt quay mới từ khách hàng.
2. Giữ dịch vụ API hoạt động ở chế độ Read-Only để khách hàng và Admin vẫn xem được lịch sử voucher / giải thưởng trong lúc điều tra.
3. Chỉ dừng Delivery Worker nếu nó đang gửi sai tin nhắn; giữ nguyên các bản ghi trong bảng `deliveries` để phục vụ đối soát.
4. Rollback bản build API / Admin / Mini App về tag release ổn định trước đó nếu sự cố do mã nguồn ứng dụng.
5. Tuyệt đối KHÔNG rollback SQL bằng cách xóa bảng hoặc xóa các dòng dữ liệu lịch sử. Tạo một migration sửa lỗi tiến lên (forward repair migration) sau khi kiểm tra file backup.
6. Nếu dịch vụ ZBS lỗi, giữ nguyên bản ghi giải thưởng trong DB và cho Worker thử lại từ hàng chờ outbox sau khi ZBS hoạt động trở lại.
7. Nếu Google Sheets lỗi, chỉ tiếp tục chạy sự kiện nếu người vận hành chấp nhận báo cáo chậm trễ; chạy lại script đồng bộ từ dữ liệu `spin_events` trong DB sau khi khắc phục xong Sheets.
8. Chỉ mở lại sự kiện (`active`) sau khi chạy bài smoke test mới chứng minh số lượt quay, tồn kho quà, tiến trình gửi tin và báo cáo đã hoạt động chính xác 100%.

---

## Giám sát Sau Kích hoạt (Post-Launch Monitoring)

- Giám sát endpoint `/health`, tỷ lệ lỗi API 5xx, tỷ lệ 401/403/409, lỗi Supabase, thời gian phản hồi p95, và số lần worker bị restart.
- Giám sát số lượng tin nhắn theo các trạng thái `pending`, `processing`, `sent`, và `failed`; cài cảnh báo nếu có bản ghi bị kẹt ở `processing`.
- Giám sát hạn mức tin nhắn ZBS và các mã lỗi từ nhà cung cấp (API key không hợp lệ, sai tham số mẫu ZNS, hết hạn OA, hết hạn mức tin).
- Kiểm tra mẫu ngẫu nhiên từng trạng thái giải thưởng trên Production mỗi ngày trong suốt thời gian diễn ra sự kiện.
- Thực hiện xuất file báo cáo / backup hàng ngày cho giải thưởng và lịch sử gửi tin của sự kiện (không làm lộ SĐT thô).
- Sau khi kết thúc sự kiện, chuyển sự kiện sang `ended`, lưu giữ toàn bộ dữ liệu lịch sử, xuất báo cáo tổng kết cuối cùng, và thu hồi/xoay các credential tích hợp tạm thời.
