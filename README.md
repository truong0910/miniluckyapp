# Lucky Wheels

Lucky Wheels has two frontend targets that share the same API and database:

| Target | Sign in | Run / build |
| --- | --- | --- |
| Web | Enter a phone number; there is no OTP verification | `npm run start` / `npm run build` in `lucky-wheels/` |
| Zalo Mini App | Verify the phone with Zalo | `npm run start:miniapp`, `npm run build:miniapp`, `npm run deploy:miniapp` |

The web build uses browser routing and does not load the Zalo SDK. The Mini App build keeps Zalo login and ZMP routing. After a winning spin, the shared backend records a ZBS delivery and its worker sends the approved Zalo message template.

## Project layout

- `lucky-wheels/`: both player app build targets
- `backend/`: participant API, admin API, and ZBS delivery worker
- `admin-web/`: campaign, prize, and delivery administration
- `lucky-wheels/supabase/migrations/`: forward-only schema and function updates

## Local setup

Install dependencies in each app folder, then create `backend/.env` from `backend/.env.example`. Set Supabase credentials. Configure `ZALO_APP_SECRET` and the ZBS key/template either in the backend environment or Admin System Settings. Set the Google Apps Script Web App URL in Admin System Settings; the optional `GOOGLE_SHEETS_WEBHOOK_URL` environment value is only a fallback. Set the API URL in `lucky-wheels/.env` and `admin-web/.env`.

Apply migrations to your Supabase project with `npx supabase db push` from `lucky-wheels/`. Do not use production credentials for database integration tests.

Start the backend, admin, and web target in separate terminals:

```bash
cd backend && npm run dev
cd admin-web && npm run dev
cd lucky-wheels && npm run start
```

To run or publish the Zalo Mini App, use its explicit commands from `lucky-wheels/`:

```bash
npm run login:miniapp
npm run start:miniapp
npm run build:miniapp
npm run deploy:miniapp
```

Run `npm run worker:delivery` in `backend/` to start the ZBS sender. It retries temporary provider failures and updates the award delivery status.

## Verification

```bash
cd backend && npm test
cd lucky-wheels && npm test && npm run build && npm run build:miniapp
```
