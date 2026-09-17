# Web and Zalo Mini App design

## Goal

Keep one shared lucky wheel product with two independently runnable frontends:

- Web: ordinary browser router, phone entry without OTP, no Zalo SDK or OA UI.
- Zalo Mini App: Zalo phone permission and the existing Zalo Mini App router/SDK.
- Both targets use the same backend and enqueue a ZBS message after an award spin.

## Design

Use Vite build mode `web` by default and `miniapp` for the Zalo target. The Vite config selects a platform router, app shell, registration form, and participant-auth adapter by target. Shared pages use a small UI facade so the web build resolves buttons/pages/navigation through React Router and native HTML. The Mini App target resolves those imports through `zmp-ui` and loads the ZMP plugin.

The web registration form submits the entered phone to a new participant phone-session endpoint. It must state clearly that the number is not verified with OTP. The Zalo registration form continues to request the phone permission and calls the existing Zalo session endpoint. Both sessions use the same participant APIs and spin logic.

The backend supports both session routes at once. A phone session creates/ensures a campaign participant with `phone_guest`; a Zalo session retains `zalo_guest`. Spinning creates the existing ZBS delivery outbox record in the same database transaction. Backend APIs and the worker read Zalo/ZBS secrets server-side from saved system settings, with environment variables as fallback. OA follow requirements and widgets are removed from the participant flow; historical database fields and rows remain intact.

The forward migration adds `phone` to allowed session methods and `phone_guest` to registration sources. It replaces the spin function with a three-argument version that no longer blocks on OA status while keeping award and ZBS outbox behavior. Existing migrations and historical participant, award, and delivery rows are preserved.

## Verification

Run backend unit tests, frontend unit tests, a normal web build, and a Mini App mode build. Inspect the web output to ensure it contains no `zmp-ui`, `zmp-sdk`, or ZMP plugin runtime. Confirm the Mini App build still invokes its plugin and uses the Zalo auth adapter.
