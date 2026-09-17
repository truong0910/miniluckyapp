# Dual web and Mini App implementation plan

1. Add platform selection for web and Mini App builds, native web routing/UI, and a browser phone-entry form. Keep Mini App routing/UI and replace its OA-dependent registration with Zalo phone permission.
2. Add a no-OTP phone session endpoint while preserving the Zalo session endpoint. Keep participant session middleware shared.
3. Keep the ZBS outbox, delivery API, admin configuration/resend, and worker. Add an additive database migration for `phone` auth and `phone_guest`, retaining award and delivery inserts while removing the OA spin gate.
4. Remove OA controls and obsolete single-target auth-mode configuration from frontend/admin/docs; document both build commands and the no-OTP behavior.
5. Run targeted tests, full backend/frontend tests, and both production builds; inspect build artifacts for target separation.
