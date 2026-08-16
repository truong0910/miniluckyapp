# Cấu hình ZBS WIFIM

ZBS được gọi từ Backend để không lộ API key trong Mini App.

Thêm vào `backend/.env`:

```env
ZBS_API_KEY=zbs_key_api_key_cua_wifim
ZBS_TEMPLATE_ID=template_id_da_duoc_duyet
ZBS_API_BASE_URL=https://zbs.wifim.vn/api
```

Backend nhận kết quả quay ở `POST /api/v1/delivery/zbs`, gọi ZBS `/v1/send`
và trả trạng thái gửi về Mini App. Template cần có các biến:

```text
customer_name
voucher_name
voucher_code
voucher_value
expiry_date
```

Nếu chưa cấu hình ZBS, việc quay vẫn được ghi nhận; Mini App chỉ hiển thị
trạng thái chưa thể gửi tin.
