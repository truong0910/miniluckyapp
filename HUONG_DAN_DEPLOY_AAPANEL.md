# Hướng Dẫn Chi Tiết Triển Khai Mini Lucky App Lên aaPanel

Tài liệu này hướng dẫn chi tiết từng bước thiết lập hạ tầng **aaPanel (Linux)**, cấu hình **Nginx Reverse Proxy**, tạo SSH Key và thiết lập **GitHub Actions CI/CD** để tự động hóa toàn bộ quy trình triển khai.

---

## 📑 MỤC LỤC
1. [Chuẩn bị trên máy chủ aaPanel](#1-chuẩn-bị-trên-máy-chủ-aapanel)
2. [Thiết lập SSH Key cho GitHub Actions](#2-thiết-lập-ssh-key-cho-github-actions)
3. [Tạo Website & Cấu hình Reverse Proxy trên aaPanel](#3-tạo-website--cấu-hình-reverse-proxy-trên-aapanel)
4. [Cấu hình GitHub Actions Secrets & Variables](#4-cấu-hình-github-actions-secrets--variables)
5. [Quy trình Deploy & Vận hành](#5-quy-trình-deploy--vận-hành)

---

## 1. Chuẩn Bị Trên Máy Chủ aaPanel

Đăng nhập vào bảng điều khiển aaPanel của bạn:

### Bước 1.1: Cài đặt Docker
1. Vào mục **App Store** trên thanh menu trái của aaPanel.
2. Tìm kiếm từ khóa `Docker`.
3. Bấm **Install** ứng dụng **Docker Manager** (hoặc mở Terminal trên aaPanel và chạy `curl -fsSL https://get.docker.com | sh`).
4. Kiểm tra trong Terminal aaPanel:
   ```bash
   docker --version
   docker compose version
   git --version
   ```
   *(Nếu chưa có git, chạy `apt update && apt install git -y` trên Ubuntu/Debian hoặc `yum install git -y` trên CentOS/AlmaLinux).*

---

## 2. Thiết Lập SSH Key Cho GitHub Actions

Để GitHub Actions có thể tự động SSH vào server aaPanel để kéo code và khởi động Docker:

### Bước 2.1: Tạo cặp SSH Key trên Server
Mở **Terminal** trên aaPanel (hoặc SSH từ máy bạn vào server với quyền `root`):
```bash
# Tạo SSH key mới (nhấn Enter liên tục để bỏ qua passphrase)
ssh-keygen -t ed25519 -C "github-actions-minilucky" -f ~/.ssh/github_deploy

# Thêm Public Key vào danh sách cho phép đăng nhập
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# In Private Key ra màn hình để copy sang GitHub
cat ~/.ssh/github_deploy
```

> [!IMPORTANT]
> Sao chép toàn bộ nội dung của Private Key (từ `-----BEGIN OPENSSH PRIVATE KEY-----` đến `-----END OPENSSH PRIVATE KEY-----`) để dán vào Secret `SSH_PRIVATE_KEY` trên GitHub.

---

## 3. Tạo Website & Cấu Hình Reverse Proxy Trên aaPanel

Giả định tên miền của bạn là `wifim.vn` (thay thế bằng tên miền thực tế của bạn). Hãy trỏ 2 bản ghi DNS trước:
- `api.lucky.wifim.vn` ➜ IP máy chủ aaPanel
- `admin.lucky.wifim.vn` ➜ IP máy chủ aaPanel

### Site 1: Backend API (`api.lucky.wifim.vn`)
1. Vào menu **Website** > Bấm **Add site**:
   - Domain: `api.lucky.wifim.vn`
   - PHP Version: Chọn `Pure Python/Static` (không cần chạy PHP).
   - Bấm **Submit**.
2. **Cài SSL (HTTPS)**:
   - Bấm vào tên site vừa tạo > Chọn menu **SSL** bên trái.
   - Chọn tab **Let's Encrypt** > Tích chọn domain > Bấm **Apply**.
   - Bật công tắc **Force HTTPS**.
3. **Cài Reverse Proxy về Docker Backend**:
   - Vẫn trong cài đặt Site > Chọn menu **Reverse Proxy** bên trái > Bấm **Add reverse proxy**:
     - **Proxy Name**: `backend_api`
     - **Target URL**: `http://127.0.0.1:8787`
     - **Sent Domain**: `$host`
     - Bấm **Submit**.
4. **Tối ưu cấu hình Proxy**:
   - Trong danh sách Reverse Proxy, bấm **ConfigFile** của `backend_api` và kiểm tra có các dòng sau:
     ```nginx
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
     proxy_read_timeout 60s;
     ```

---

### Site 2: Admin Web Dashboard (`admin.lucky.wifim.vn`)
1. Vào menu **Website** > Bấm **Add site**:
   - Domain: `admin.lucky.wifim.vn`
   - PHP Version: `Pure Python/Static`.
   - Bấm **Submit**.
2. **Cài SSL (HTTPS)**:
   - Vào mục **SSL** > Tab **Let's Encrypt** > Bấm **Apply** > Bật **Force HTTPS**.
3. **Cài Reverse Proxy về Docker Admin**:
   - Vào menu **Reverse Proxy** > Bấm **Add reverse proxy**:
     - **Proxy Name**: `admin_web`
     - **Target URL**: `http://127.0.0.1:5174`
     - **Sent Domain**: `$host`
     - Bấm **Submit**.

---

## 4. Cấu Hình GitHub Actions Secrets & Variables

Trên GitHub repository của bạn, vào **Settings** > **Secrets and variables** > **Actions**:

### A. Tab "Variables" (Bấm `New repository variable`)

| Tên Variable | Giá Trị Cần Điền (Ví Dụ) |
|:---|:---|
| `SSH_PORT` | `22` (hoặc cổng SSH bạn đổi trên aaPanel, ví dụ `2222`) |
| `APP_ENV` | `production` |
| `PARTICIPANT_AUTH_MODE` | `zalo` |
| `ADMIN_AUTH_MODE` | `supabase` |
| `PARTICIPANT_SESSION_TTL_SECONDS` | `1800` |
| `SUPABASE_URL` | `https://ndipzfrsqwtfrwalboyd.supabase.co` |
| `CORS_ORIGINS` | `https://admin.lucky.wifim.vn,https://h5.zalo.me` |
| `VITE_API_BASE_URL` | `https://api.lucky.wifim.vn/api/v1` |
| `VITE_ZALO_OA_ID` | `1872524082920628490` |
| `ZALO_APP_ID` | `1761900008417905543` |
| `ZALO_GRAPH_BASE_URL` | `https://graph.zalo.me` |
| `ZBS_API_BASE_URL` | `https://zbs.wifim.vn/api` |
| `DELIVERY_POLL_MS` | `5000` |
| `DELIVERY_BATCH_SIZE` | `10` |
| `DELIVERY_MAX_ATTEMPTS` | `8` |

---

### B. Tab "Secrets" (Bấm `New repository secret`)

| Tên Secret | Giá Trị Cần Điền |
|:---|:---|
| `SSH_HOST` | Địa chỉ IP máy chủ VPS của bạn (VD: `103.x.x.x`) |
| `SSH_USER` | `root` |
| `SSH_PRIVATE_KEY` | Toàn bộ nội dung private key đã tạo ở Bước 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | Lấy trong Supabase Project Settings > API > service_role key |
| `SUPABASE_ANON_KEY` | Lấy trong Supabase Project Settings > API > anon public key |
| `DEV_AUTH_SECRET` | Chuỗi bí mật ngẫu nhiên (VD: `random-secret-key-32-chars-long`) |
| `ADMIN_EMAIL` | Email đăng nhập admin (nếu dùng fallback) |
| `ADMIN_PASSWORD` | Mật khẩu admin (nếu dùng fallback) |
| `ZALO_APP_SECRET` | Khóa Zalo App Secret trong Zalo Developer Console |
| `ZBS_API_KEY` | Key ZBS Wifim (nếu có) |
| `ZBS_TEMPLATE_ID` | Template ID ZBS (nếu có) |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Webhook URL Apps Script |
| `GOOGLE_SHEETS_WEBHOOK_SECRET` | Secret của Google Sheets (nếu có) |
| `ZMP_TOKEN` | Token CLI Zalo Mini App (`eyJ0eXAiOi...`) |

---

## 5. Quy Trình Deploy & Vận Hành

### Kích hoạt Deploy:
- Mỗi khi bạn `git push` code lên nhánh `master` (hoặc `main`), GitHub Actions sẽ:
  1. Tự động chạy bộ test để xác thực tính toàn vẹn code.
  2. Tự động SSH vào máy chủ aaPanel, pull code mới về `/www/wwwroot/miniluckyapp`.
  3. Tự động build lại Docker containers (`backend-api`, `delivery-worker`, `admin-web`) và reload không downtime.
  4. Tự động build và deploy bản mới nhất của Mini App lên Zalo Cloud.

### Các lệnh kiểm tra & quản lý trên máy chủ aaPanel:
Mở **Terminal** trên aaPanel và di chuyển vào thư mục dự án:
```bash
cd /www/wwwroot/miniluckyapp

# Xem trạng thái các containers đang chạy
docker compose ps

# Xem nhật ký logs theo thời gian thực của Backend
docker compose logs -f backend-api

# Xem nhật ký của Worker gửi tin ZBS
docker compose logs -f delivery-worker

# Khởi động lại toàn bộ hệ thống thủ công
docker compose restart
```

