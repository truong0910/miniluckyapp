# Lucky Wheels — Zalo Mini App

Ứng dụng gồm Mini App, Admin Web (`../admin-web`) và Backend (`../backend`).
Backend là nơi duy nhất thực hiện xác thực, đọc Supabase và quyết định kết quả quay.

## Chạy local

```bash
npm install
cd ..\backend && npm install
cd ..\admin-web && npm install
```

Tạo `../backend/.env` từ `../backend/.env.example`, rồi chạy:

```bash
npm run backend:dev
npm run start
npm run admin:dev
```

Mini App mặc định gọi `http://localhost:8787/api/v1`. Đặt
`VITE_PARTICIPANT_AUTH_MODE=preview` cho local; production phải dùng `zalo`.

## Đăng ký và số điện thoại

Ô số điện thoại luôn cho phép nhập tay. Nút “Tự động điền SĐT Zalo” gọi
quyền `scope.userPhonenumber`. Ở local, số nhập tay bắt đầu preview session.
Ở production, Backend chỉ chấp nhận Zalo phone token và App Secret; số nhập
tay một mình không thể tạo session.

Session Mini App chỉ lưu opaque token và expiry trong `sessionStorage`. Mọi
request sau đó tự gắn Bearer token; không lưu customer ID để làm quyền.

## Quay và delivery

Mỗi lần quay gửi `Idempotency-Key` UUID và không gửi `customerId` trong body.
Backend gọi RPC `spin_once` để khóa customer, kiểm tra quota, khóa inventory,
ghi event và tạo delivery outbox trong cùng transaction. Worker riêng chạy:

```bash
cd ..\backend
npm run worker:delivery
```

ZBS chỉ nhận dữ liệu do worker đọc từ DB; lỗi provider retry tối đa 8 lần.

## Kiểm tra

```bash
npm test -- --run
npm run build
```

Migration Supabase xem tại `supabase/README.md`. Không apply migration vào
production khi chưa có test project và quyền Zalo/App Secret phù hợp.
