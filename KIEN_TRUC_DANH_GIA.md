# Đánh giá kiến trúc dự án Zalo Mini App — Lucky Wheels

## 1. Kết luận tổng quan

Dự án đang dùng mô hình 3 thành phần:

```text
Zalo Mini App ─┐
               ├─> Express Backend ─> Supabase
Admin Web ─────┘                    └─> ZBS/ZNS
```

Việc tách Mini App, Admin Web và Backend là hướng đúng. `SUPABASE_SERVICE_ROLE_KEY` và `ZBS_API_KEY` cũng đang được giữ ở Backend.

Tuy nhiên, dự án hiện phù hợp cho demo/thử nghiệm hơn là production. Các rủi ro lớn nhất nằm ở xác thực participant, tính nguyên tử của lượt quay/tồn kho và endpoint gửi ZBS.

Đánh giá sơ bộ:

| Hạng mục | Mức đánh giá |
| --- | ---: |
| Phân tách ứng dụng | 7/10 |
| Mô hình dữ liệu | 5/10 |
| An toàn nghiệp vụ quay thưởng | 2/10 |
| Bảo mật production | 2/10 |
| Khả năng bảo trì/kiểm thử | 3/10 |

## 2. Các điểm đang làm tốt

- Mini App và Admin Web không truy cập Supabase service role trực tiếp.
- Backend có lớp mapping dữ liệu, rule engine và các route được tách riêng.
- Supabase đã bật RLS cho các bảng chính.
- Có kiểm tra số điện thoại Việt Nam ở cả client và server.
- Kết quả quay được lưu ở Backend thay vì chỉ lưu ở trình duyệt.
- Có tách cấu hình môi trường cho Backend, Admin Web và Mini App.

## 3. Vấn đề cần xử lý ngay — P0

### 3.1. API khách hàng chưa có xác thực

Các API tra cứu khách hàng, lấy thông tin khách hàng, xem lịch sử quay và thực hiện quay đều có thể gọi mà không cần participant token. API quay chỉ nhận `customerId` từ request body: [public.routes.js](/D:/thuctap/zalominiapp/backend/src/routes/public.routes.js:116).

Mini App chỉ lưu ID trong `sessionStorage` rồi gửi lại cho Backend: [participant.services.ts](/D:/thuctap/zalominiapp/lucky-wheels/src/services/participant.services.ts:20), [spin.services.ts](/D:/thuctap/zalominiapp/lucky-wheels/src/services/spin.services.ts:12).

Hệ quả:

- Có thể đoán hoặc thay `customerId` để xem dữ liệu người khác.
- Có thể quay thay người khác.
- ID seed như `KH001`, `KH002` dễ bị dò.
- Dữ liệu tên, số điện thoại, nghề nghiệp và voucher bị lộ.

Nên xác minh Zalo user/phone token ở Backend, sau đó cấp participant session token ngắn hạn. Backend phải lấy danh tính từ token, không tin `customerId` tùy ý từ client.

### 3.2. Lượt quay và tồn kho không có transaction

Luồng hiện tại là đếm lượt, chọn quà, cập nhật tồn kho rồi insert `spin_events`: [public.routes.js](/D:/thuctap/zalominiapp/backend/src/routes/public.routes.js:124), [rule-engine.js](/D:/thuctap/zalominiapp/backend/src/rule-engine.js:64).

Hai request đồng thời có thể:

- Dùng cùng một `spin_number`.
- Vượt quá số lượt được cấp.
- Cùng nhận phần thưởng cuối cùng.
- Ghi đè cập nhật tồn kho của nhau.
- Trừ tồn kho nhưng không ghi được kết quả quay.

Schema chưa có unique constraint `(customer_id, spin_number)`: [0001_lucky_wheels.sql](/D:/thuctap/zalominiapp/lucky-wheels/supabase/migrations/0001_lucky_wheels.sql:144).

Nên đưa toàn bộ nghiệp vụ vào một Postgres RPC/function `spin_once()` trong transaction, khóa participant và inventory, đồng thời thêm idempotency key cho các lần retry do mạng.

### 3.3. Endpoint gửi ZBS tin dữ liệu từ client

`POST /delivery/zbs` nhận `phone`, `reward`, `customerName`, `spinId` từ request nhưng không kiểm tra `spinId` có tồn tại, thuộc khách nào, đã trúng gì hay đã gửi chưa: [public.routes.js](/D:/thuctap/zalominiapp/backend/src/routes/public.routes.js:161).

Bất kỳ ai gọi được API đều có thể gửi nội dung tùy ý tới số điện thoại tùy ý, gây spam và tiêu tốn quota ZBS.

Nên sửa thành:

- Client chỉ gửi `spinId`.
- Backend lấy recipient và reward từ database.
- Có bảng `deliveries` hoặc `outbox`, unique theo `spin_id`.
- Có retry/backoff và idempotency.
- Endpoint lấy danh sách template không để public.

### 3.4. Backdoor Admin development có thể hoạt động trong production

Middleware chấp nhận token cố định `local-development-token` khi có `ADMIN_EMAIL` và `ADMIN_PASSWORD`: [middleware.js](/D:/thuctap/zalominiapp/backend/src/middleware.js:10). Login fallback cũng dùng chính điều kiện này: [admin.routes.js](/D:/thuctap/zalominiapp/backend/src/routes/admin.routes.js:20).

Không có điều kiện `NODE_ENV === "development"`. Nếu production còn hai biến môi trường trên, người biết chuỗi token hard-code có thể truy cập toàn bộ Admin API.

Nên xóa fallback hoặc chỉ bật trong development bằng secret ngẫu nhiên riêng.

## 4. Vấn đề nghiệp vụ và cấu trúc — P1

### 4.1. OA follow đang không nhất quán

Mini App gọi `/spins` chỉ gửi `customerId`, không gửi `oaFollowed`: [spin.services.ts](/D:/thuctap/zalominiapp/lucky-wheels/src/services/spin.services.ts:12). Backend lại kiểm tra `Boolean(req.body.oaFollowed)`: [public.routes.js](/D:/thuctap/zalominiapp/backend/src/routes/public.routes.js:131).

Ngoài ra, `oaService.isFollowed()` mặc định trả về `true` khi chưa có trạng thái trong session: [oa.services.ts](/D:/thuctap/zalominiapp/lucky-wheels/src/services/oa.services.ts:15).

Kết quả là client chính thức có thể luôn bị coi là chưa follow, còn client giả mạo có thể tự gửi `oaFollowed: true`. Điều kiện OA phải được xác minh ở Backend, không dựa vào session storage.

### 4.2. Admin UI và rule engine không cùng mức năng lực

Database/backend hỗ trợ nhiều lượt, nhiều phần thưởng, group, thời gian, `spin_count`, `max_wins` và `special_conditions`. Admin UI chỉ sửa lượt đầu và quà đầu: [App.jsx](/D:/thuctap/zalominiapp/admin-web/src/App.jsx:63).

Khi lưu rule, Backend xóa toàn bộ `rule_spin_configs` rồi tạo lại từ form: [admin.routes.js](/D:/thuctap/zalominiapp/backend/src/routes/admin.routes.js:189).

Hệ quả:

- Sửa rule nhiều lượt có thể làm mất các lượt/quà còn lại.
- `remaining_quantity` có thể bị reset về `quantity`.
- Nếu thao tác lỗi giữa chừng, rule bị để ở trạng thái không đầy đủ.
- API có group/assignment nhưng Admin UI chưa có màn hình quản lý tương ứng.

Phần lưu rule cần transaction và không được reset tồn kho đã sử dụng.

### 4.3. Chưa có thực thể voucher đã trao rõ ràng

Hiện có ba nguồn dữ liệu:

- `reward_catalog`: danh mục quà.
- `customer_rewards`: quà cấp sẵn.
- `spin_events`: kết quả quay.

Quà sinh ra từ rule chỉ được ghi vào `spin_events`, còn lịch sử Mini App chủ yếu đọc từ `sessionStorage`: [voucher.tsx](/D:/thuctap/zalominiapp/lucky-wheels/src/pages/voucher.tsx:37).

Sau khi đổi thiết bị hoặc kết thúc session, lịch sử chi tiết và trạng thái gửi voucher không đáng tin cậy.

Nên có bảng `awards` hoặc `vouchers` chứa:

```text
id, campaign_id, spin_id, customer_id, reward_id,
code, title_snapshot, value_snapshot,
status, issued_at, delivered_at, redeemed_at, expires_at
```

### 4.4. Thiếu khái niệm campaign

Lượt quay đang được đếm trên toàn bộ lịch sử khách hàng. Không có `campaign_id` trong participant allocation, spin, inventory hoặc award.

Khi chạy chương trình mới, dữ liệu cũ và mới sẽ trộn với nhau. Nên thêm bảng `campaigns` và gắn rule, participant, inventory, spin, voucher vào từng campaign.

### 4.5. Một số field có nhưng chưa được thực thi

Các field `allow_unlisted`, `allow_refollow`, `spin_count`, `special_conditions` được lưu nhưng rule engine không dùng. `max_total_wins` cũng đang đếm theo khách trên nhiều rule, có thể khác ý nghĩa giới hạn tổng của campaign: [rule-engine.js](/D:/thuctap/zalominiapp/backend/src/rule-engine.js:52).

Cần viết đặc tả nghiệp vụ trước, sau đó thống nhất schema, engine và Admin UI theo cùng một contract.

## 5. Chất lượng mã và vận hành — P2

- Workspace root chưa phải Git repository.
- Chỉ `lucky-wheels` có `.gitignore`; `backend/.env` và `admin-web/.env` không được ignore ở cấp root.
- Workspace đang có build output, log và thư mục tạm như `www`, `dist`, `logs`, `undefined/temp`.
- Không có test file, script `test`, `lint`, `format`, `typecheck` hoặc CI.
- Backend JavaScript syntax check đã chạy qua.
- Mini App có `tsconfig.json` nhưng chưa cài package `typescript`, nên `npx tsc --noEmit` không chạy được.
- Admin UI dồn hầu hết tính năng vào một file [App.jsx](/D:/thuctap/zalominiapp/admin-web/src/App.jsx:1), khó bảo trì.
- API Admin chưa phân trang và có N+1 query khi tải danh sách khách hàng: [admin.routes.js](/D:/thuctap/zalominiapp/backend/src/routes/admin.routes.js:123).
- Admin token không có refresh flow; role `admin/editor` tồn tại nhưng middleware chưa phân quyền theo role.
- Chưa có validation tập trung, rate limit, security headers, request ID, structured logging hoặc timeout khi gọi ZBS.
- Demo customer và số điện thoại mẫu nằm trong migration production; nên chuyển sang seed development riêng.

## 6. Cấu trúc đề xuất

```text
zalominiapp/
├─ apps/
│  ├─ mini-app/
│  ├─ admin-web/
│  └─ api/
├─ packages/
│  ├─ contracts/       # DTO, schema validation, shared types
│  └─ domain/          # rule semantics dùng chung
├─ supabase/
│  ├─ migrations/
│  └─ seed.dev.sql
├─ package.json        # npm workspaces
├─ .gitignore
└─ README.md
```

Luồng production nên là:

```text
Mini App
  → Backend xác minh Zalo identity
  → cấp participant token
  → POST /spins + idempotency key
  → Postgres transaction/RPC
      ├─ kiểm tra campaign/lượt/OA
      ├─ khóa và trừ inventory
      ├─ ghi spin
      ├─ tạo voucher
      └─ tạo delivery outbox
  → worker gửi ZBS
```

## 7. Lộ trình ưu tiên

### Giai đoạn 1 — Bảo mật và tính đúng

1. Tắt backdoor `local-development-token` ngoài development.
2. Thêm participant authentication.
3. Bảo vệ `/customers/*`, `/spins` và `/delivery/*`.
4. Chuyển nghiệp vụ quay sang transaction/RPC.
5. Thêm idempotency và unique constraint.
6. Backend tự lấy reward/phone từ database khi gửi ZBS.

### Giai đoạn 2 — Chuẩn hóa domain

1. Thêm `campaigns`.
2. Tách `awards/vouchers` và `deliveries`.
3. Định nghĩa lại semantics của rule và inventory.
4. Đồng bộ rule engine với Admin UI.
5. Tạo shared API contracts và runtime validation.

### Giai đoạn 3 — Chất lượng vận hành

1. Tách Admin UI thành các page/component/feature.
2. Thêm TypeScript cho Admin hoặc ít nhất validation schema.
3. Cài và chạy typecheck, lint, format.
4. Viết unit test cho rule engine và integration test cho `spin_once`.
5. Thêm CI, migration pipeline, logging, monitoring và rate limit.

## 8. Kết luận cuối

Nền tảng hiện tại có hướng tổ chức hợp lý cho một prototype, nhưng chưa nên đưa vào chương trình thật có voucher hoặc quota ZNS. Bốn việc cần làm trước tiên là:

1. Xác thực participant ở Backend.
2. Đảm bảo transaction/lock cho lượt quay và tồn kho.
3. Khóa endpoint ZBS và thêm delivery idempotency.
4. Loại bỏ hoàn toàn Admin development token khỏi production.

Chưa có mã nguồn nào khác được chỉnh sửa trong quá trình đánh giá.
