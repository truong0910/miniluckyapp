# Handoff: Quản lý Nhóm khách hàng trong Admin

## Mục tiêu

Bổ sung chức năng quản lý **nhóm khách hàng** trong Admin Web để gom nhiều khách vào cùng một phân nhóm và áp dụng luật quay riêng cho nhóm đó.

Ví dụ nhóm:

- Khách VIP
- Đại lý
- Nhân viên nội bộ
- Khách mua hàng giá trị cao

Một khách hàng có thể thuộc nhiều nhóm. Nhóm khách không thay thế campaign participant.

## Phân biệt ba khái niệm

| Khái niệm | Phạm vi | Dữ liệu chính |
|---|---|---|
| `customers` / Khách hàng | Toàn hệ thống | Tên, số điện thoại, hồ sơ gốc |
| `campaign_participants` / Khách sự kiện | Một campaign | Tham gia campaign, quota, trạng thái, ghi chú |
| `customer_groups` / Nhóm khách | Toàn hệ thống | Tên nhóm và danh sách thành viên |

Quota quay luôn lấy theo campaign participant. Group chỉ dùng để chọn rule/điều kiện áp dụng.

## Schema hiện có

Schema đã có trong `lucky-wheels/supabase/migrations/0001_lucky_wheels.sql`:

- `customer_groups(id, name, created_at)`
- `customer_group_members(group_id, customer_id, created_at)`
- `group_rule_assignments(group_id, rule_id, created_at)`

Không được xóa khách hàng, campaign, spin event, award hoặc delivery khi thao tác group. Xóa group (nếu giữ API này) chỉ được xóa metadata liên kết group; phải cảnh báo rõ cho Admin. Có thể chọn archive thay vì hard delete nếu cần migration bổ sung.

## Trạng thái code hiện tại (đã kiểm tra)

Tính năng nhóm khách đã có trong code hiện tại, không còn chỉ là bản thiết kế:

- `backend/src/customer-group-service.js` đã có CRUD group, quản lý thành viên, quản lý rule và xoá liên kết metadata.
- `backend/src/routes/admin.routes.js` đã có các route group và tất cả đều dùng `requireAdmin`.
- Admin Web đã có tab **Nhóm khách** trong `admin-web/src/App.jsx`, gồm tạo/đổi tên/xoá group, thêm/xoá thành viên và gán/bỏ gán rule theo campaign.
- Đã có test nền tại `backend/test/customer-group-service.test.js` và `backend/test/admin-groups.test.js`.

### Backend service đã có

`backend/src/customer-group-service.js` hiện có các hàm:

- `listGroups({ db, search })`: danh sách group, số thành viên, thời gian tạo.
- `createGroup({ db, name })`: tạo group, không cho tên rỗng/trùng.
- `renameGroup({ db, id, name })`: đổi tên group nếu cần.
- `listGroupMembers({ db, groupId, page, limit, search })`.
- `replaceGroupMembers({ db, groupId, customerIds })` hoặc API add/remove riêng.
- `addGroupMember({ db, groupId, customerId })`.
- `removeGroupMember({ db, groupId, customerId })`.
- `listGroupRules({ db, groupId })`.
- `assignRuleToGroup({ db, groupId, ruleId })`.
- `removeRuleFromGroup({ db, groupId, ruleId })`.
- `deleteGroup({ db, id })` chỉ xóa liên kết group, không xóa customer/history.

Lưu ý: một số kiểm tra tồn tại hiện đang dựa vào foreign key/Supabase error, chưa phải lỗi nghiệp vụ rõ ràng ở service.

### API hiện tại

Tất cả route phải có `requireAdmin`:

- `GET /admin/groups?search=`
- `POST /admin/groups` body `{ "name": "VIP" }`
- `PUT /admin/groups/:id` body `{ "name": "VIP mới" }`
- `DELETE /admin/groups/:id`
- `GET /admin/groups/:id/members?page=1&limit=20&search=`
- `POST /admin/groups/:id/members` body `{ "customerId": "customer-1" }` để thêm một người, hoặc `{ "customerIds": ["customer-1"] }` để thay toàn bộ danh sách
- `POST /admin/groups/:id/members/:customerId`
- `DELETE /admin/groups/:id/members/:customerId`
- `GET /admin/groups/:id/rules?campaignId=...`
- `POST /admin/groups/:id/rules` body `{ "ruleId": "rule-1" }` để gán một rule, hoặc `{ "ruleIds": ["rule-1"] }` để thay toàn bộ danh sách
- `POST /admin/groups/:id/rules/:ruleId`
- `DELETE /admin/groups/:id/rules/:ruleId`

Khi gán rule, phải kiểm tra rule thuộc campaign hợp lệ. Không được gán nhầm rule của campaign khác nếu UI đang chọn campaign hiện tại.

Route cũ `POST /admin/campaign-rules/:id/assign-groups` vẫn còn trong file để tương thích ngược; nên quyết định giữ hay loại bỏ sau khi xác nhận không còn client nào gọi.

## Điểm cần agent tiếp theo xử lý sau khi review

1. Xoá các route group cũ bị khai báo trùng ở phần sau của `backend/src/routes/admin.routes.js` (khoảng dòng 455 trở đi). Route mới ở phía trên đang được Express ưu tiên, nhưng phần trùng làm code khó bảo trì.
2. Bổ sung test route/UI và các trường hợp lỗi HTTP thực tế; test hiện tại chủ yếu là service mock và kiểm tra source route.
3. Sửa tìm kiếm thành viên: `listGroupMembers` đang phân trang trước rồi mới lọc `search` trong JavaScript, nên `total` và số dòng trả về có thể sai khi tìm kiếm.
4. Cân nhắc kiểm tra rõ group/customer/rule tồn tại trước khi insert và trả lỗi thân thiện, thay vì chỉ chờ lỗi foreign key.
5. Xác định phạm vi của `replaceGroupRules`: hiện thao tác xoá toàn bộ assignment của group, có thể xoá liên kết thuộc campaign khác. Nếu group dùng chung nhiều campaign thì cần thay theo `campaignId` hoặc ghi rõ đây là hành vi chủ ý.
6. Chạy lại toàn bộ kiểm thử/build sau các chỉnh sửa:

```powershell
npm test
npm run build
npm run test:db
```

Kết quả lần kiểm tra hiện tại:

- `npm test`: backend 74 pass, 2 skip; frontend 8 pass.
- `npm run build`: mini app và Admin Web đều build thành công.
- `npm run test:db`: 17 pass, 2 skip vì migration `0006` và `0007` chưa áp dụng trên remote test database.

## Admin Web đã có; các điểm cần xác nhận

Menu **Nhóm khách** đã có trong `admin-web/src/App.jsx`. Màn hình hiện đã hỗ trợ:

Màn hình cần có:

1. Danh sách group: tên, số thành viên, số rule được gán.
2. Tạo, đổi tên và xoá group.
3. Xem/tìm kiếm danh sách customer để thêm hoặc xóa thành viên.
4. Chọn campaign rồi chọn các rule thuộc campaign đó để gán/bỏ gán cho group.
5. Xác nhận trước khi xoá group.

Nên kiểm tra bổ sung thông báo lỗi customer/rule không hợp lệ và thao tác hàng loạt nếu cần.

Customer selector nên hỗ trợ tìm theo tên/số điện thoại, không bắt Admin nhập `customer_id` thủ công.

## Lưu ý quan trọng về Import Excel

File hiện tại dùng:

- `Tên KH`
- `SĐT`
- `Số voucher tặng`
- `Ghi chú`

Trong chế độ voucher, `Ghi chú` chứa mệnh giá như `5 triệu, 3 triệu`. **Không được tự động coi nội dung Ghi chú là tên group**, nếu không sẽ tạo group sai như `5 triệu, 3 triệu`.

Nếu muốn import group từ Excel, chỉ hỗ trợ khi bổ sung cột riêng, ví dụ:

- `Nhóm khách`
- `Group`

Cột group phải được xử lý độc lập với cột mệnh giá voucher. Có thể để đây là bước mở rộng sau, không làm ảnh hưởng import hiện tại.

## Quy tắc vận hành

- Group là phân loại dùng chung; participant vẫn phải tồn tại trong campaign active mới được quay.
- Một khách có thể thuộc nhiều group.
- Một group có thể được gán nhiều rule.
- Một rule có thể được gán nhiều group.
- Rule campaign-specific phải được lọc theo `campaign_id`.
- Không copy spin event, award, delivery hoặc timestamp lịch sử khi tạo group/clone campaign.
- Không reset database và không xóa dữ liệu lịch sử.

## Kiểm thử bắt buộc / còn thiếu

Đã có test service cơ bản và contract route. Cần bổ sung hoặc xác nhận thêm:

- Tạo group và chặn tên rỗng/trùng.
- Thêm cùng một customer hai lần không tạo bản ghi trùng.
- Xóa thành viên không xóa customer master.
- Gán cùng một rule hai lần không tạo bản ghi trùng.
- Không gán rule không tồn tại.
- Danh sách group trả đúng member count.
- Group rule chỉ áp dụng trong campaign của rule đó.
- Import Excel hiện tại không tạo group từ `Ghi chú` mệnh giá.
- API/UI đều yêu cầu Admin authentication.

Chạy sau khi hoàn tất:

```powershell
npm test
npm run build
npm run test:db
```

## Tiêu chí nghiệm thu

- Admin nhìn thấy tab **Nhóm khách** và thao tác được mà không gọi trực tiếp Supabase.
- Tạo/sửa/xem thành viên/gán rule hoạt động theo campaign được chọn.
- Không làm thay đổi quota campaign hoặc dữ liệu lịch sử.
- Refresh trang không mất group/member/rule assignment.
- Import voucher hiện tại vẫn hiểu đúng cột `Ghi chú` là mệnh giá.
- Tất cả test và build pass; không dùng `git reset --hard` hoặc xóa dữ liệu thật để test.
