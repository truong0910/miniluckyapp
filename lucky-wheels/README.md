# Lucky Wheels frontend

This package builds two versions of the same player app. The normal web target is the default and uses browser routing plus phone entry without OTP verification. The separate Zalo Mini App target keeps ZMP navigation, SDK phone verification, and the Zalo app shell.

## Commands

```bash
npm install
npm run start                 # Web development server
npm run build                 # Web production build in dist/
npm run test

npm run login:miniapp         # Authenticate the ZMP CLI
npm run start:miniapp         # Zalo Mini App development server
npm run build:miniapp         # Mini App production build
npm run deploy:miniapp        # Deploy through the ZMP CLI
```

Set `VITE_API_BASE_URL` in `.env` to the shared backend. The web form sends the entered phone to the backend without OTP; show users that this number is unverified. The Mini App obtains a phone token from Zalo. Keep Zalo and ZBS secrets in backend System Settings or its environment.

After a winning spin, both targets use the backend ZBS delivery outbox. The ZBS key and template ID stay on the backend; run its `worker:delivery` process to send the approved template.

`nginx.conf` includes SPA fallback routing for direct browser visits to pages such as `/wheel` and `/voucher`.
