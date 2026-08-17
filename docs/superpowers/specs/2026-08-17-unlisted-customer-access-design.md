# Đặc tả: Khách ngoài danh sách, xác minh Zalo và chỉnh voucher trong Admin

**Ngày:** 2026-08-17  
**Trạng thái:** Đã duyệt để triển khai  
**Đối tượng:** Agent triển khai Backend, Supabase và Admin Web

## 1. Mục tiêu

Cho phép Admin quyết định khách chưa có trong `campaign_participants` có được tham gia sự kiện hay không.

Khi được cho phép:

1. Khách xác minh số điện thoại bằng Zalo.
2. Backend tìm hoặc tạo customer theo số điện thoại đã xác minh.
3. Backend tự tạo participant cho sự kiện active với quota mặc định **1 lượt**.
4. Khách quay theo rule dành cho khách ngoài danh sách hoặc rule phù hợp.
5. Admin có thể sửa quota, tạm khóa quyền quay, gán rule riêng và quản lý voucher theo từng sự kiện.

Dữ liệu khách hàng và lịch sử cũ phải được giữ nguyên; không reset hoặc xóa dữ liệu để triển khai.

## 2. Quyết định đã chốt

- Chỉ một campaign `active` tại một thời điểm.
- Campaign có toggle **Cho khách ngoài danh sách tham gia**.
- Quota mặc định của khách ngoài danh sách là `1`; Admin có thể sửa từng khách.
- Guest có thể dùng rule chung `scope=guest` hoặc rule riêng `scope=user`.
- Local `preview` vẫn cho nhập số thủ công để test; production dùng Zalo auth.
- Voucher đã phát thành award là lịch sử bất biến.
- Voucher cấp sẵn chưa dùng chỉ được sửa trước lượt quay đầu tiên của khách trong campaign.

## 3. Hiện trạng cần kế thừa

### Đã có

- Mini App gọi `getPhoneNumber()` và lấy `access_token`.
- Backend có `POST /participant/sessions/zalo` và `resolveZaloPhone`.
- `ZALO_APP_SECRET` nằm trong backend configuration.
- `campaign_participants` có quota/status theo campaign.
- `customer_rewards` đã có `campaign_id`.
- `spin_once` đang chặn khách không có participant ở campaign mới bằng lỗi `P0003`.
- Backend đã có `PUT /admin/customers/:id`, nhưng Admin Web chưa có nút sửa.

### Chưa đủ

- Chưa có chính sách campaign cho khách ngoài danh sách.
- Participant chưa lưu nguồn tham gia.
- `allow_unlisted` trên `campaign_rules` đang tồn tại nhưng chưa được engine sử dụng; không dùng field này thay cho policy campaign.
- Màn hình Customer chưa sửa được quota/voucher theo campaign.
- Một số API customer đang đọc voucher theo `customer_id` toàn cục; màn hình mới phải lọc thêm `campaign_id`.

## 4. Chính sách campaign

### 4.1. Migration

Thêm migration additive:

```sql
alter table public.campaigns
  add column if not exists allow_unlisted boolean not null default false,
  add column if not exists unlisted_spin_quota integer not null default 1;

alter table public.campaigns
  add constraint campaigns_unlisted_spin_quota_check
  check (unlisted_spin_quota >= 0);
```

Giá trị mặc định `false` bảo đảm campaign cũ không tự mở cho khách mới.

Thêm nguồn participant:

```sql
alter table public.campaign_participants
  add column if not exists registration_source text not null default 'admin';

alter table public.campaign_participants
  add constraint campaign_participants_registration_source_check
  check (registration_source in ('import', 'zalo_guest', 'admin'));
```

Backend tự đặt nguồn, không nhận từ client:

- Import Excel: `import`.
- Tự đăng ký qua Zalo/preview khi chưa có participant: `zalo_guest`.
- Admin thêm thủ công: `admin`.

Giữ unique `(campaign_id, customer_id)` để chống tạo trùng khi retry.

### 4.2. Admin UI

Trong form campaign thêm nhóm **Khách ngoài danh sách**:

- Toggle: `Cho phép khách ngoài danh sách tham gia`.
- Quota mặc định: mặc định `1`.
- Rule guest mặc định: chọn rule `scope=guest`.

Khi tắt toggle:

- Khách mới chưa có participant bị từ chối.
- Participant đã tồn tại không tự bị xóa; Admin dùng `paused` nếu cần dừng riêng khách.

## 5. Luồng xác minh và tự đăng ký

```text
Mini App gọi getPhoneNumber()
  → người dùng đồng ý
  → gửi phone token + access token lên Backend
  → Backend đổi token với Zalo bằng ZALO_APP_SECRET
  → chuẩn hóa số điện thoại
  → tìm/tạo customer
  → xử lý participant của active campaign
```

Nếu đã có participant, giữ nguyên quota/status.

Nếu chưa có participant:

- `allow_unlisted=true`: upsert `status=active`, `spin_quota=unlisted_spin_quota`, `registration_source=zalo_guest`.
- `allow_unlisted=false`: trả lỗi `Khách chưa được đăng ký trong sự kiện này`, không tạo participant.

Luồng phải idempotent và không log phone token, access token hoặc app secret.

Trong local `preview`, cho nhập phone thủ công và chạy cùng chính sách auto-enroll; production phải từ chối preview.

## 6. Rule cho guest

### 6.1. Scope

Mở rộng `campaign_rules.scope` để hỗ trợ `guest` bên cạnh `default`, `group`, `user`.

- `guest`: chỉ participant có `registration_source='zalo_guest'`.
- `default`: participant hợp lệ không có rule cụ thể hơn.
- `group`: participant thuộc group được gán.
- `user`: customer được gán trực tiếp rule.

`spin_once` phải kiểm tra nguồn participant và campaign hiện tại; không suy ra guest từ dữ liệu client.

### 6.2. Thứ tự xét

1. `priority` giảm dần.
2. Nếu bằng nhau: `user > group > guest > default`.
3. Nếu vẫn bằng nhau: `created_at` tăng dần.

Một rule đã được chọn nhưng trượt `win_rate`, hết kho hoặc đạt giới hạn thì trả `better_luck`; không tự rơi xuống rule thấp hơn. UI phải giải thích rõ điều này.

### 6.3. Tỷ lệ riêng từng khách

Không thêm xác suất vào bảng `customers` global. Màn hình sửa khách tạo/gán rule `scope=user` thuộc campaign hiện tại. Rule riêng chứa win rate, reward, quantity và giới hạn riêng.

Nếu không có override, khách guest dùng rule `scope=guest` chung của campaign.

## 7. Màn hình Khách hàng

Mỗi dòng customer có nút **Sửa**. Khi mở phải chọn hoặc hiển thị rõ campaign đang thao tác.

### Hồ sơ chung

- Tên, số điện thoại, giới tính, nghề nghiệp.
- Đổi số điện thoại phải có cảnh báo vì ảnh hưởng định danh.

### Tham gia sự kiện

- Trạng thái `active`, `paused`, `removed`.
- Nguồn tham gia chỉ đọc.
- Quota, đã dùng, còn lại.
- Nút **Cho phép quay** / **Tạm khóa quay**.

Nếu chưa có participant, **Cho phép quay** tạo participant `registration_source=admin` với quota Admin nhập.

### Voucher cấp sẵn

- Danh sách planned voucher của campaign.
- Thêm voucher từ danh mục giải.
- Sửa mệnh giá/giải trước lượt quay đầu.
- Nhập mã voucher thật nếu có.
- Không sửa/xóa planned voucher sau khi khách đã quay; khi đó dùng thao tác cấp award bổ sung có lý do.

### Rule riêng

- Chọn rule `scope=user` thuộc campaign.
- Cho phép tạo bản sao rule để chỉnh tỷ lệ/giải riêng.
- Hiển thị rule đang áp dụng và priority bằng ngôn ngữ tự nhiên.

## 8. API đề xuất

Tất cả route phải có `requireAdmin`:

```text
GET  /admin/campaigns/:campaignId/participants/:customerId
PUT  /admin/campaigns/:campaignId/participants/:customerId
     body: { status, spinQuota }

GET  /admin/campaigns/:campaignId/participants/:customerId/rewards
PUT  /admin/campaigns/:campaignId/participants/:customerId/rewards
     body: { assignments: [...] }

GET  /admin/campaigns/:campaignId/participants/:customerId/rule
PUT  /admin/campaigns/:campaignId/participants/:customerId/rule
     body: { ruleId }

POST /admin/campaigns/:campaignId/participants/:customerId/manual-awards
     body: { rewardId, code, reason }
```

`PUT rewards` chỉ thay planned voucher trước spin đầu tiên. `manual-awards` tạo award/audit mới, không sửa spin hoặc award lịch sử.

Route global `/admin/customers/:id` chỉ sửa hồ sơ customer; quota, rule và voucher phải dùng route campaign-scoped.

## 9. Readiness và lỗi

Thêm hoặc mở rộng:

```text
GET /admin/campaigns/:id/readiness
```

Checklist:

- Campaign đúng trạng thái.
- Guest policy hợp lệ.
- Quota mặc định không âm.
- Guest rule thuộc đúng campaign.
- Reward active và tồn kho hợp lệ.
- Không còn lỗi import.
- Không bật OA nếu backend chưa xác minh OA.

Thông báo cần rõ nghiệp vụ:

- `Khách chưa được đăng ký trong sự kiện này`.
- `Sự kiện chưa sẵn sàng`.
- `Khách đã quay, không thể sửa voucher cấp sẵn`.
- `Rule không thuộc sự kiện đang chọn`.
- `Số lượt mặc định không hợp lệ`.

## 10. Bảo mật và dữ liệu

- Không tin `customerId`, `registration_source`, `campaignId` hoặc `oaFollowed` từ client nếu backend tự suy ra được.
- Xác minh phone bằng Zalo trước khi tự tạo guest participant.
- `ZALO_APP_SECRET` chỉ nằm ở backend.
- Giữ participant session server-owned.
- Che số điện thoại ở danh sách Admin nếu không cần hiển thị đầy đủ.
- Khách không được tự đặt quota, reward, rule hoặc status.
- Dùng unique constraint và transaction/upsert để chống trùng.

## 11. Test bắt buộc

### Database/migration

- Campaign mặc định `allow_unlisted=false`, `unlisted_spin_quota=1`.
- Không nhận quota âm.
- Participant source chỉ nhận ba giá trị hợp lệ.
- Auto-enroll retry không tạo participant trùng.

### Auth/API

- Zalo hợp lệ + policy bật tạo đúng participant `zalo_guest` với 1 lượt.
- Zalo hợp lệ + policy tắt trả lỗi và không tạo participant.
- Zalo token lỗi không tạo customer/participant.
- Preview local test được; production từ chối preview.
- Chỉ Admin sửa quota/reward/rule.

### Rule/spin

- Guest rule chỉ áp dụng cho `zalo_guest`.
- User override thắng guest/default khi priority phù hợp.
- Guest hết quota bị chặn.
- Guest rule hết kho không lấy nhầm voucher campaign khác.
- Retry idempotency không tạo spin/award thứ hai.

### Customer Admin

- Nút sửa mở đúng campaign context.
- Tạo participant Admin với quota tùy chỉnh.
- Pause participant chặn lượt mới nhưng giữ lịch sử.
- Thay planned voucher trước spin đầu thành công.
- Thay planned voucher sau spin đầu bị từ chối.
- Manual award không sửa spin/award cũ.

Chạy sau triển khai:

```powershell
npm test
npm run build
npm run test:db
```

## 12. Phân kỳ triển khai cho agent

### Task 1 — Migration và campaign policy

Thêm policy campaign, participant source và test migration.

### Task 2 — Guest enrollment

Tạo service `ensureCampaignParticipant`, gọi sau Zalo/preview authentication, xử lý toggle, quota và idempotency.

### Task 3 — Rule engine

Mở rộng scope `guest`, sửa `spin_once` xét nguồn guest và user override, thêm test campaign isolation.

### Task 4 — Admin API

Thêm participant detail/update, planned reward list/replace, user rule assignment và manual award có lý do.

### Task 5 — Admin UI

Thêm toggle guest/quota ở campaign, nút sửa customer, quota/status, voucher planned, rule riêng và cảnh báo.

### Task 6 — Readiness và tài liệu

Thêm readiness endpoint, preview/dry-run an toàn, test Zalo khi có credential và cập nhật hướng dẫn vận hành.

## 13. Tiêu chí nghiệm thu

- Admin bật/tắt được khách ngoài danh sách theo từng campaign.
- Khách Zalo chưa có trong danh sách được tự tạo với đúng 1 lượt khi policy bật.
- Policy tắt thì khách mới bị từ chối và không tạo participant.
- Admin sửa được quota/status theo từng campaign.
- Admin thêm/sửa voucher cấp sẵn trước spin đầu.
- Admin gán được rule riêng để thay đổi tỷ lệ/giải cho một khách.
- Không sửa hoặc xóa lịch sử spin, award, delivery.
- Local preview test được không cần quyền Zalo; production không nhận preview.
- Tất cả test và build pass.

## 14. Không thuộc phạm vi

- Tự động xác minh follow OA; đây là quyền riêng với phone permission.
- Nhiều Admin hoặc phân quyền phức tạp.
- Cho khách tự chọn giải hoặc tự tăng quota.
- Xóa lịch sử voucher đã phát.
- Chạy song song nhiều campaign active.
