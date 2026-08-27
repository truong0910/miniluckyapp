# Mini Lucky App — Hệ Thống Vòng Quay May Mắn Zalo Mini App

Hệ thống **Vòng Quay May Mắn (Lucky Wheel)** hoàn chỉnh dành cho Zalo Mini App, tích hợp trang Quản trị (Admin Web), Backend Node.js Express, Supabase Database và dịch vụ gửi thông báo ZBS (Wifim).

---

## 📐 Kiến Trúc Hệ Thống

Dự án bao gồm 3 thành phần chính:

```
miniluckyapp/
├── lucky-wheels/     # Zalo Mini App Frontend (React, Vite, ZMP SDK, TypeScript)
├── backend/          # Node.js Express API Server & Worker
└── admin-web/        # Trang Quản trị Admin (React, Vite, Tailwind CSS)
```

1. **`lucky-wheels` (Zalo Mini App)**:
   - Giao diện người chơi trên Zalo Mini App (hoặc Web Browser local).
   - Tích hợp Zalo SDK (`zmp-sdk`) lấy thông tin xác thực (`accessToken`, `phoneToken`).
   - Hỗ trợ 2 chế độ auth (`VITE_PARTICIPANT_AUTH_MODE`): `preview` (dành cho test local qua SĐT) và `zalo` (dành cho môi trường Zalo chính thức).

2. **`backend` (API Server & Worker)**:
   - Xử lý các request quay thưởng, xác thực token Zalo, kiểm tra hạn ngạch lượt quay.
   - Sử dụng **Supabase RPC (`spin_once`)** với cơ chế khóa dữ liệu `FOR UPDATE` và kiểm tra kho nguyên tử (atomic decrement) để phòng chống tuyệt đối lỗi tranh chấp kho khi có nhiều người quay cùng lúc.
   - Chạy **Delivery Worker** bối cảnh riêng để gửi thông báo trúng thưởng qua ZBS (Zalo Business Service / Wifim) và đồng bộ với Google Sheets Webhook.

3. **`admin-web` (Trang Quản Trị)**:
   - Quản lý các chiến dịch (Campaigns), danh sách khách hàng & phân nhóm (Customer Groups).
   - Cấu hình quy tắc vòng quay (Rule Engine): Tỷ lệ trúng (`win_rate`), lượt trúng tối đa (`max_wins`), giải thưởng (`reward_catalog`).
   - Tính năng **Dry Run Spin**: Test giả lập kết quả quay theo thuật toán rules mà không làm ảnh hưởng đến dữ liệu thật.
   - Thống kê & Báo cáo kết quả chiến dịch chi tiết.

---

## ✨ Tính Năng Nổi Bật

- 🔒 **An Toàn Tuyệt Đối Khi Tranh Chấp Kho (Race Condition Protection)**: Hàm `spin_once` trong PostgreSQL đảm bảo nếu giải thưởng chỉ còn 1 cái mà 2 người cùng quay trúng đồng thời, hệ thống sẽ chỉ trao giải cho 1 người và tự động chuyển người còn lại sang *"Chúc bạn may mắn lần sau"*.
- 🔑 **Đa Dạng Chế Độ Xác Thực**: Linh hoạt chuyển đổi giữa thử nghiệm trên Browser (`preview`) và xác thực bảo mật qua Zalo App Secret (`zalo`).
- ⚡ **Idempotency & Session An Toàn**: Mỗi lượt quay kèm theo `Idempotency-Key` ngăn chặn gửi trùng request. Session Mini App chỉ lưu Token có thời hạn trong `sessionStorage`.
- 📊 **Rule Engine Linh Hoạt**: Cấu hình theo từng số lượt quay (Spin Number), độ ưu tiên của rule, hạn ngạch lượt quay theo nhóm khách hàng hoặc khách tự do (`guest`).
- 📲 **Tự Động Gửi Thông Báo & Sync**: Tích hợp ZBS Wifim tự động gửi SMS/Zalo notification cho người trúng thưởng và đẩy dữ liệu về Google Sheets realtime.

---

## 🚀 Hướng Dẫn Khởi Chạy Local

### 1. Cài đặt Dependencies

Tại thư mục gốc dự án:

```bash
# Cài đặt cho Backend
cd backend && npm install

# Cài đặt cho Admin Web
cd ../admin-web && npm install

# Cài đặt cho Mini App
cd ../lucky-wheels && npm install
```

### 2. Cấu hình File Môi Trường (.env)

* **Backend (`backend/.env`)**: Tạo từ `backend/.env.example`
  ```env
  PORT=8787
  SUPABASE_URL=https://<your-supabase-id>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
  SUPABASE_ANON_KEY=<your-anon-key>
  CORS_ORIGINS=http://localhost:5173,http://localhost:5174
  ZBS_API_KEY=<your-zbs-key>
  ZBS_TEMPLATE_ID=<your-template-id>
  ```

* **Mini App (`lucky-wheels/.env`)**: Tạo từ `lucky-wheels/.env.example`
  ```env
  VITE_API_BASE_URL=http://localhost:8787/api/v1
  VITE_PARTICIPANT_AUTH_MODE=preview   # Đặt 'preview' cho Local Dev, 'zalo' cho Production
  VITE_ZALO_OA_ID=<your-zalo-oa-id>
  ```

* **Admin Web (`admin-web/.env`)**: Tạo từ `admin-web/.env.example`
  ```env
  VITE_API_BASE_URL=http://localhost:8787/api/v1
  ```

### 3. Chạy Ứng Dụng

Mở 3 terminal riêng biệt để chạy 3 dịch vụ:

* **Terminal 1: Chạy Backend Server & Delivery Worker**
  ```bash
  cd backend
  npm run dev
  # Nếu muốn chạy riêng Delivery Worker:
  # npm run worker:delivery
  ```

* **Terminal 2: Chạy Admin Web Dashboard**
  ```bash
  cd admin-web
  npm run dev
  ```
  *(Admin Web chạy tại: `http://localhost:5174`)*

* **Terminal 3: Chạy Zalo Mini App**
  ```bash
  cd lucky-wheels
  npm run dev
  ```
  *(Mini App chạy tại: `http://localhost:2999` hoặc `http://localhost:5173`)*

---

## 🛠 Database & Migrations (Supabase)

Tất cả file SQL migration tạo bảng, trigger, RLS policies và hàm `spin_once` được lưu tại:
`lucky-wheels/supabase/migrations/`

Để áp dụng các migration vào Supabase:
```bash
cd lucky-wheels
npx supabase db push
```

---

## 📜 Giấy Phép & Đóng Góp

Dự án được xây dựng cho hệ sinh thái Zalo Mini App. Mọi đóng góp hoặc báo lỗi vui lòng tạo Issue/Pull Request tại repository:
👉 [https://github.com/truong0910/miniluckyapp](https://github.com/truong0910/miniluckyapp)
