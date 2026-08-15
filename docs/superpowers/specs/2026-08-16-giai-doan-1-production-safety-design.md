# Thiết kế Giai đoạn 1 — An toàn và tính đúng đắn production

## Mục tiêu

Nâng hệ thống Lucky Wheels từ prototype lên nền tảng an toàn cho việc thử nghiệm production, nhưng giữ nguyên cấu trúc ba ứng dụng và toàn bộ dữ liệu Supabase hiện có.

Giai đoạn này tập trung vào bốn rủi ro P0:

1. API participant không còn tin `customerId` do client gửi.
2. Lượt quay, quota và inventory được xử lý nguyên tử trong Postgres.
3. Endpoint ZBS không còn nhận phone/reward tùy ý từ client.
4. Development admin token không thể hoạt động trong production.

Các thay đổi được triển khai tuần tự trên `backend/`, `admin-web/`, `lucky-wheels/` và migration Supabase hiện có. Chưa chuyển monorepo, chưa chuẩn hóa toàn bộ domain campaign/award và chưa reset dữ liệu.

## Phạm vi và ngoài phạm vi

### Trong phạm vi

- Participant session ngắn hạn, có preview auth và Zalo auth.
- Tự động điền số điện thoại khi người dùng bấm nút lấy số từ Zalo.
- Transactional `spin_once()` và idempotency key.
- Delivery outbox và worker gửi ZBS có retry.
- Signed development admin session chỉ chạy local.
- Contract API mới, migration tương thích ngược và kiểm thử các điều kiện cạnh tranh.

### Ngoài phạm vi Giai đoạn 1

- Tách monorepo hoặc đổi framework.
- Thiết kế đầy đủ `campaigns`, `awards/vouchers` và rule domain mới.
- Tách lại toàn bộ Admin UI.
- CI/CD, monitoring, rate limit nâng cao và migration pipeline.
- Xác minh OA bằng dữ liệu do client gửi. Field `oaFollowed` từ client sẽ bị bỏ qua.

## Kiến trúc tổng thể

```text
Mini App
  → Participant Session API
  → Bearer participant token
  → Public API đã bảo vệ
  → Postgres RPC spin_once()
      ├─ khóa customer và inventory
      ├─ ghi spin_events
      └─ tạo deliveries outbox
                         ↓
              Delivery Worker → ZBS

Admin Web → Supabase Auth hoặc signed development session → Admin API
```

Backend vẫn là lớp duy nhất truy cập Supabase bằng service role. Mini App và Admin Web không nhận service role key.

## Xác thực participant

### Session storage

Tạo bảng `participant_sessions`:

```text
id uuid primary key
customer_id text references customers(id)
token_hash text unique
auth_method text check (auth_method in ('preview', 'zalo'))
expires_at timestamptz
revoked_at timestamptz
created_at timestamptz
last_seen_at timestamptz
```

Backend tạo token ngẫu nhiên tối thiểu 32 byte, chỉ lưu SHA-256 hash. Session mặc định hết hạn sau 30 phút. Middleware kiểm tra hash, hạn dùng và `revoked_at` trước khi gắn `req.participant`.

### API

- `POST /participant/sessions/preview`: chỉ được bật khi `APP_ENV=development`; nhận số điện thoại thủ công, kiểm tra customer còn hoạt động và cấp session.
- `POST /participant/sessions/zalo`: nhận `accessToken` và phone token từ Mini App, đổi phone token ở Zalo Open API, chuẩn hóa số và cấp session.
- `GET /participant/me`: trả profile và quota của session hiện tại.
- `GET /participant/me/spins`: trả lịch sử quay của session hiện tại.
- `GET /delivery/:spinId`: chỉ trả trạng thái delivery thuộc participant hiện tại.

Các route public cũ `/customers/lookup`, `/customers/:id` và `/customers/:id/spins` không còn được dùng để truy cập dữ liệu participant. Client mới không gửi `customerId`; client cũ nhận lỗi chuyển đổi rõ ràng thay vì được fallback sang API không xác thực.

### Form số điện thoại

Form luôn có ô nhập số điện thoại và nút “Lấy số từ Zalo”. Nút này không tự động gọi khi mở màn hình.

- Nếu SDK trả số trực tiếp, Mini App điền vào ô và tiếp tục tạo session.
- Nếu SDK trả phone token, Mini App gửi token cùng access token lên Backend; Backend xác minh rồi trả số đã chuẩn hóa và session.
- Nếu người dùng từ chối quyền hoặc Mini App chưa được cấp quyền, ô nhập tay vẫn hoạt động trong preview/local.
- Production chỉ chấp nhận số đã được xác minh từ Zalo. Số nhập tay không được dùng làm định danh production nếu không có một cơ chế xác minh bổ sung.

Luồng production tuân theo tài liệu Zalo: `getPhoneNumber()` trả token một lần, token hết hạn sau 2 phút; Backend gọi `GET https://graph.zalo.me/v2.0/me/info` với `access_token`, `code` và `secret_key` của Zalo App.

### Môi trường

- Local: `APP_ENV=development`, `PARTICIPANT_AUTH_MODE=preview`.
- Production: `APP_ENV=production`, `PARTICIPANT_AUTH_MODE=zalo`.
- Backend fail-fast nếu production bật preview auth hoặc thiếu secret cần thiết.
- Preview backend local bind vào loopback mặc định; không phát hành preview endpoint cho host production.

## Admin authentication

Xóa chuỗi `local-development-token` cố định.

Local có thể đăng nhập bằng cặp `ADMIN_EMAIL`/`ADMIN_PASSWORD`, nhưng chỉ khi `APP_ENV=development`; Backend phát hành signed session ngắn hạn bằng `DEV_AUTH_SECRET`. `requireAdmin` xác minh chữ ký và hạn dùng.

Production chỉ dùng Supabase Auth và `admin_profiles`. Nếu production còn cấu hình development auth, Backend từ chối khởi động.

## Transactional spin

Migration bổ sung:

- Partial unique index trên `(customer_id, spin_number)` để bảo vệ dữ liệu cũ có thể chứa `NULL`.
- `idempotency_key` trên `spin_events`, unique theo customer khi có giá trị.
- Index cho lookup customer, idempotency và delivery.
- Function `public.spin_once(p_customer_id, p_idempotency_key, p_oa_followed)` với `SECURITY DEFINER`, `search_path=public` và quyền execute chỉ cho Backend service role.

Migration kiểm tra duplicate hiện có trước khi tạo unique index và dừng với lỗi mô tả rõ; không tự xóa dữ liệu.

### Quy trình `spin_once()`

1. Khóa customer bằng `FOR UPDATE`.
2. Tìm idempotency key; nếu đã commit thì trả lại snapshot kết quả cũ.
3. Tính spin number tiếp theo và kiểm tra `total_spins`.
4. Chọn active rule theo window, scope, priority, max wins và cấu hình spin hiện có.
5. Chọn reward theo probability, khóa dòng inventory bằng `FOR UPDATE` và trừ `remaining_quantity`.
6. Nếu không có reward hợp lệ, tạo outcome `better_luck`.
7. Ghi `spin_events` với rule, reward code, result và reward snapshot trong `metadata`.
8. Tạo delivery outbox khi có reward.
9. Trả về `spinId`, timestamp, outcome, result, reward và `spinsRemaining`.

Toàn bộ các bước nằm trong một transaction. Bất kỳ lỗi nào cũng rollback cả inventory và spin event. `oaFollowed` chỉ được truyền từ server-side adapter; giá trị gửi từ client bị loại bỏ. Khi chưa có OA adapter, rule yêu cầu OA được xem là không đủ điều kiện thay vì tin session storage.

### API contract

`POST /spins` bắt buộc có:

```http
Authorization: Bearer <participant-session>
Idempotency-Key: <uuid>
```

Body không chứa `customerId`, phone, reward hoặc `oaFollowed`. Mini App tạo UUID trước mỗi lần quay và dùng lại UUID nếu retry sau timeout.

## Delivery outbox và worker

Tạo bảng `deliveries`:

```text
id uuid primary key
spin_id uuid unique references spin_events(id)
status text check (status in ('pending', 'processing', 'sent', 'failed'))
attempts integer default 0
next_attempt_at timestamptz
locked_at timestamptz
message_id text
last_error text
sent_at timestamptz
created_at timestamptz
updated_at timestamptz
```

`spin_once()` chỉ tạo outbox record, không gọi ZBS trong transaction.

Worker chạy riêng bằng `npm run worker:delivery` và:

- claim batch qua RPC dùng `FOR UPDATE SKIP LOCKED`;
- đọc phone từ `customers` và reward snapshot từ `spin_events`;
- gửi ZBS với request ID ổn định theo `delivery.id`;
- đánh dấu `sent` và lưu `message_id` khi thành công;
- retry tối đa 8 lần với exponential backoff và giới hạn thời gian;
- đưa record bị kẹt ở `processing` trở lại queue;
- giữ trạng thái `pending` khi ZBS chưa cấu hình để không làm mất voucher.

Client không gửi `phone`, `reward` hoặc `customerName` cho ZBS. Endpoint templates chỉ nằm dưới Admin API.

## Lỗi và hành vi client

- `401`: xóa participant session, yêu cầu đăng ký/xác thực lại.
- `403`: hiển thị lỗi quyền.
- `409 NO_SPINS`: không còn lượt; `409 IDEMPOTENCY_CONFLICT`: cùng key nhưng payload không hợp lệ.
- `429`: yêu cầu thử lại sau.
- `502`: ZBS upstream lỗi; delivery vẫn còn trong outbox.
- `503`: ZBS chưa cấu hình; spin vẫn thành công và delivery chờ worker.

Mini App không tự trừ quota trước khi Backend trả kết quả commit.

## Kiểm thử và xác minh

### Unit tests

- hash/expiry/revoke participant token;
- preview auth bị từ chối trong production;
- Zalo phone normalization;
- signed development admin session;
- client luôn gửi Bearer token và idempotency key;
- client không gửi `customerId`, phone hoặc reward khi quay.

### Database integration tests

Chạy trên Supabase test project riêng, không chạy trên production:

- 10 request đồng thời cho cùng customer không tạo duplicate spin number;
- inventory không âm;
- cùng idempotency key chỉ tạo một event;
- retry trả đúng event cũ;
- lỗi giữa chừng rollback toàn bộ transaction;
- delivery duy nhất cho mỗi spin.

### Worker tests

- claim không trùng khi có nhiều worker;
- retry/backoff theo trạng thái;
- stale processing được thu hồi;
- response ZBS thành công lưu message ID;
- lỗi ZBS không làm mất delivery.

## Rollout an toàn

1. Sao lưu Supabase và chạy migration `0002` trên test project.
2. Chạy unit/integration tests và kiểm tra duplicate trước khi tạo index.
3. Bật local preview auth, kiểm tra nhập tay và nút tự động lấy số.
4. Chạy Backend và delivery worker ở hai terminal local.
5. Khi Zalo cấp quyền, cấu hình App Secret và chuyển Mini App sang Zalo auth.
6. Trước production, đặt `APP_ENV=production`, tắt preview auth, dùng Supabase Admin Auth và kiểm tra worker trên host chạy liên tục.

## Tiêu chí hoàn thành

Giai đoạn 1 hoàn thành khi participant không thể đọc hoặc quay thay customer khác bằng ID tùy ý; concurrent spin không vượt quota hoặc inventory; ZBS chỉ gửi dữ liệu lấy từ database; development token bị vô hiệu hóa ngoài local; và toàn bộ các test concurrency/idempotency/outbox đều vượt qua.
