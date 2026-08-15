# Supabase và kiến trúc 3 phần

Ứng dụng có ba phần độc lập:

- Mini App Zalo: build ở thư mục gốc, chỉ gọi Backend API.
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

# terminal 2 - Mini App
npm run start

# terminal 3 - Admin Web
cd ../admin-web && npm install && npm run dev
```

Mini App cần `VITE_API_BASE_URL=http://localhost:8787/api/v1` trong `.env`.
Admin Web cần giá trị tương tự trong `../admin-web/.env`.
