# Supabase và kiến trúc 3 phần

Ứng dụng có ba phần độc lập:

- Bản Web: build mặc định, dùng browser router và nhập SĐT không OTP.
- Mini App Zalo: build bằng `npm run build:miniapp`, dùng ZMP SDK xác minh SĐT.
- Admin Web: thư mục ngang hàng `../admin-web/`, chạy port `5174` khi dev.
- Backend: thư mục ngang hàng `../backend/`, chạy port `8787`, là nơi duy nhất giữ Supabase service role key.

## Cấu hình Supabase

1. Mở `supabase/migrations/0001_lucky_wheels.sql` trong SQL Editor và chạy một lần.
2. Tạo tài khoản Admin tại Supabase Dashboard → Authentication → Users.
3. Thêm UUID tài khoản vào bảng `admin_profiles`:

```sql
insert into public.admin_profiles (user_id, role)
values ('AUTH_USER_UUID', 'admin');
```

4. Tạo `../backend/.env` từ `../backend/.env.example`:

```env
PORT=8787
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_publishable_key
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào Mini App, Admin Web, Git hoặc file `.env` ở thư mục gốc.

## Chạy

```bash
# terminal 1
cd ../backend && npm install && npm run dev

# terminal 2 - Web
npm run start

# terminal 3 - Zalo Mini App (cần ZMP CLI)
npm run start:miniapp

# terminal 4 - Admin Web
cd ../admin-web && npm install && npm run dev
```

Hai bản người chơi cần `VITE_API_BASE_URL=http://localhost:8787/api/v1` trong `.env`.
Admin Web cần giá trị tương tự trong `../admin-web/.env`.
