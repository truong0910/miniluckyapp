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

## Trạng thái code hiện tại

Backend hiện đã có một phần endpoint:

- `GET /api/v1/admin/groups`
- `POST /api/v1/admin/groups`
- `POST /api/v1/admin/groups/:id/members` — hiện đang thay toàn bộ danh sách thành viên
- `POST /api/v1/admin/campaign-rules/:id/assign-groups` — gán group vào rule

Admin Web hiện chưa có tab Nhóm khách hàng. Cần bổ sung UI và hoàn thiện API/service.

## Chức năng cần triển khai

### Backend service

Tạo `backend/src/customer-group-service.js` với các hàm:

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

Mọi hàm phải kiểm tra group/customer/rule tồn tại và trả lỗi dễ hiểu.

### API đề xuất

Tất cả route phải có `requireAdmin`:

- `GET /admin/groups?search=`
- `POST /admin/groups` body `{ "name": "VIP" }`
- `PUT /admin/groups/:id` body `{ "name": "VIP mới" }`
- `DELETE /admin/groups/:id`
- `GET /admin/groups/:id/members?page=1&limit=20&search=`
- `PUT /admin/groups/:id/members` body `{ "customerIds": ["customer-1"] }`
- `POST /admin/groups/:id/members/:customerId`
- `DELETE /admin/groups/:id/members/:customerId`
- `GET /admin/groups/:id/rules`
- `PUT /admin/groups/:id/rules` body `{ "ruleIds": ["rule-1"] }`

Khi gán rule, phải kiểm tra rule thuộc campaign hợp lệ. Không được gán nhầm rule của campaign khác nếu UI đang chọn campaign hiện tại.

## Admin Web cần bổ sung

Thêm menu **Nhóm khách** trong `admin-web/src/App.jsx`.

Màn hình cần có:

1. Danh sách group: tên, số thành viên, số rule được gán.
2. Tạo group.
3. Đổi tên group.
4. Xem/tìm kiếm thành viên.
5. Thêm hoặc xóa thành viên.
6. Chọn campaign rồi chọn các rule thuộc campaign đó để gán cho group.
7. Xác nhận trước khi xóa group hoặc xóa hàng loạt thành viên.
8. Thông báo rõ lỗi trùng tên, customer không tồn tại và rule không hợp lệ.

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

## Kiểm thử bắt buộc

Viết test trước khi triển khai:

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
