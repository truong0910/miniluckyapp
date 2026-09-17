# Hướng dẫn vận hành Lucky Wheels

Lucky Wheels có hai giao diện người chơi dùng chung backend và dữ liệu:

- **Bản Web:** mở bằng trình duyệt; người chơi nhập số điện thoại để tìm lượt quay. Số điện thoại không được xác minh bằng OTP.
- **Bản Zalo Mini App:** người chơi cấp quyền cho Zalo xác minh số điện thoại. Bản này giữ tích hợp ZMP SDK.

Không cần theo dõi OA để đăng nhập hoặc quay. Khi người chơi trúng thưởng, backend đưa tin nhắn vào hàng đợi ZBS; worker gửi mẫu tin Zalo đã được duyệt.

## Dữ liệu và thông báo trúng thưởng

Backend lưu session, lượt quay, voucher và trạng thái gửi tin trong Supabase. Mỗi spin dùng idempotency key; khi trúng, award và hàng đợi ZBS được ghi trong cùng transaction. Worker đọc số điện thoại và thông tin voucher từ backend rồi gửi qua ZBS. Nếu gửi lỗi tạm thời, worker thử lại; trạng thái voucher hiển thị trong trang Admin.

Webhook Google Sheets dùng để đồng bộ báo cáo. Lịch sử quay và voucher cũng có thể xuất từ trang Admin.

## Vận hành sự kiện

1. Đăng nhập trang Admin bằng tài khoản được cấp quyền.
2. Tạo hoặc kích hoạt campaign, nhập danh sách khách hàng/lượt quay và thiết lập voucher cùng luật quay.
3. Kiểm tra ngày giờ, quota và số lượng quà trước khi kích hoạt.
4. Cấu hình ZBS API key và template trong trang Admin hoặc backend environment; chạy tiến trình `npm run worker:delivery`.
5. Mở trang Web hoặc Mini App tương ứng để kiểm tra quy trình đăng nhập, quay thử và thông báo.

## Build và phát hành

Trong `lucky-wheels/`:

```bash
npm run build             # Bản Web
npm run build:miniapp     # Bản Zalo Mini App
npm run deploy:miniapp    # Đẩy bản Mini App qua ZMP CLI
```

Docker/Compose dùng build Web mặc định. Hai bản đều gọi cùng API; cấu hình `VITE_API_BASE_URL` trỏ tới backend đang chạy.
