# Lucky Wheels backend

The API supports both frontend targets: phone sessions for the web build and Zalo phone-token sessions for the Mini App. The web phone entry has no OTP check. Set `ZALO_APP_SECRET` in the backend environment or System Settings so the Mini App can verify its phone token.

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

Start the ZBS sender separately:

```bash
npm run worker:delivery
```

The backend holds `SUPABASE_SERVICE_ROLE_KEY`, `ZALO_APP_SECRET`, and `ZBS_API_KEY`. Zalo and ZBS settings saved by an admin are read server-side from `program_settings`; environment variables remain the fallback. Do not expose them in either frontend.

## Participant API

- `POST /api/v1/participant/sessions/phone` — web phone entry, no OTP.
- `POST /api/v1/participant/sessions/zalo` — Zalo Mini App phone-token exchange.
- `GET /api/v1/participant/me` and `/participant/me/spins` — participant Bearer session.
- `POST /api/v1/spins` — participant session and `Idempotency-Key`; the database transaction records the spin, award, and ZBS outbox item.
- `POST /api/v1/delivery/zbs` — read the queued delivery for the participant's own winning spin.
- `GET /api/v1/delivery/zbs/templates` — admin-only ZBS template lookup.

The worker sends queued deliveries, retries temporary failures, and updates award status. Configure `ZBS_API_KEY`, `ZBS_TEMPLATE_ID`, and `ZBS_API_BASE_URL` in the backend environment.

## Database

Apply migrations in `lucky-wheels/supabase/migrations/` in order. Migration `0018_dual_auth_zbs_delivery.sql` adds the phone session method and `phone_guest` registration source, removes OA as a spin requirement, and retains award creation plus ZBS outbox enqueueing. It does not delete historical participant, award, or delivery records.

Use `npm run test:db` only with a dedicated Supabase test project configured through `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY`.
