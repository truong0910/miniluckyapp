# Lucky Wheels Backend

Backend local mặc định tại `http://localhost:8787`.

## Chạy local

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Worker gửi voucher chạy riêng:

```bash
npm run worker:delivery
```

Backend là lớp duy nhất giữ `SUPABASE_SERVICE_ROLE_KEY`, `ZALO_APP_SECRET`
và `ZBS_API_KEY`. Không đưa các secret này vào Mini App hoặc Admin Web.

## Environment

- Local: `APP_ENV=development`, `PARTICIPANT_AUTH_MODE=preview`.
- Production: `APP_ENV=production`, `PARTICIPANT_AUTH_MODE=zalo`,
  `ZALO_APP_SECRET` bắt buộc; không dùng development admin auth.
- `PARTICIPANT_SESSION_TTL_SECONDS` mặc định 1800 giây.
- Worker dùng `WORKER_ID`, `DELIVERY_POLL_MS`, `DELIVERY_BATCH_SIZE` và
  `DELIVERY_MAX_ATTEMPTS` (mặc định 8).

## Participant API

- `POST /api/v1/participant/sessions/preview` — chỉ development, nhận số điện thoại nhập tay.
- `POST /api/v1/participant/sessions/zalo` — production, đổi Zalo phone token ở Backend.
- `GET /api/v1/participant/me` và `/participant/me/spins` — Bearer session.
- `POST /api/v1/spins` — Bearer session + `Idempotency-Key`; customer identity,
  quota, reward và inventory chỉ lấy từ server/RPC.
- `POST /api/v1/delivery/zbs` — Bearer session, chỉ xếp hàng delivery của chính spin.

Các route customer cũ trả `410` và không còn dùng để cấp quyền. Templates ZBS
là route admin-only.

## Database rollout

Áp dụng lần lượt:

1. `lucky-wheels/supabase/migrations/0001_lucky_wheels.sql`
2. `lucky-wheels/supabase/migrations/0002_phase1_production_safety.sql`

Migration thứ hai là additive, không reset hoặc xóa dữ liệu hiện có. Nó thêm
participant sessions, `spin_once`, idempotency, delivery outbox và claim/finish
RPC cho worker. Chỉ chạy `npm run test:db` với một Supabase test project riêng;
runner yêu cầu `SUPABASE_TEST_URL` và `SUPABASE_TEST_SERVICE_ROLE_KEY`.
