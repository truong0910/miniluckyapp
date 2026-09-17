# Participant Awards API (Phase 2B.2) Design

**Date:** 2026-08-16  
**Status:** Design approved in conversation; implementation not started

## Goal

Expose a participant-scoped read API for durable voucher awards created by
Phase 2B.1. The API must use the authenticated participant session as its only
identity source, return immutable reward snapshots and lifecycle timestamps,
and replace the backend dependency on client-controlled customer IDs without
changing spin execution, delivery, or Mini App UI in this phase.

## Scope

### In scope

- Add `GET /api/v1/participant/me/awards` to the existing public router.
- Require the existing `requireParticipant` middleware.
- Add a small award query/mapping service with deterministic pagination.
- Return participant-safe award snapshots and lifecycle fields.
- Add unit/static route tests and opt-in database assertions where useful.
- Keep `awards` RLS and service-role access unchanged; the Backend remains the
  trusted read boundary.

### Out of scope

- Creating awards from `spin_once` (deferred until the award-creation phase).
- Delivery worker/provider changes, redemption workflows, expiry processing,
  or admin award management.
- Mini App voucher-history UI or frontend service wiring.
- Any route that accepts `customerId` from query parameters or request bodies.

## API contract

### Request

```http
GET /api/v1/participant/me/awards?page=1&limit=20
Authorization: Bearer <participant-session-token>
```

- `page` is optional, defaults to `1`, and must be an integer from `1` to
  `100`.
- `limit` is optional, defaults to `20`, and must be an integer from `1` to
  `50`.
- No customer identity is accepted from the URL, query string, body, or a
  client-supplied header.

### Response

```json
{
  "items": [
    {
      "id": "award-uuid",
      "campaignId": "campaign-uuid",
      "spinEventId": "spin-uuid",
      "rewardId": "catalog-id-or-null",
      "code": "DTT_VOUCHER_5M_01",
      "title": "Voucher 5.000.000d",
      "value": 5000000,
      "description": "Voucher mua hang tri gia 5.000.000d",
      "result": ["red_envelope", "red_envelope", "red_envelope"],
      "status": "issued",
      "issuedAt": "2026-08-16T00:00:00.000Z",
      "deliveredAt": null,
      "redeemedAt": null,
      "expiresAt": null
    }
  ],
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```

The service queries at most `limit + 1` rows, orders by `issued_at DESC` and
then `id DESC`, and sets `hasMore` from the extra row. An empty participant
history is a successful response with an empty `items` array.

## Architecture and data flow

1. Express matches `/participant/me/awards`.
2. `requireParticipant` hashes and validates the opaque session token, then
   attaches the server-resolved `customerId` to `req.participant`.
3. The route validates `page` and `limit`; invalid values become the existing
   public `400` error shape.
4. `listParticipantAwards({ db, customerId, page, limit })` queries
   `public.awards` with `customer_id = customerId` and the approved ordering.
5. The service maps snake_case database columns to the camelCase API contract
   and never includes phone numbers, delivery payloads, metadata, or another
   participant's records.
6. Supabase errors continue through the existing error handler; internal
   database details are not returned to the participant.

The Backend uses its existing service-role Supabase client. Browser clients do
not receive the service-role key and do not query Supabase directly.

## Error and compatibility behavior

- Missing, malformed, revoked, or expired participant tokens return `401`
  through `requireParticipant`.
- Invalid `page` or `limit` returns `400` using `publicError`.
- Valid requests with no awards return `200` and `items: []`.
- Existing `/participant/me`, `/participant/me/spins`, `/spins`, and delivery
  routes retain their current contracts.
- The endpoint is read-only and does not mutate awards, sessions, spins, or
  deliveries.

## Testing strategy

- Unit-test pagination, ordering arguments, customer scoping, snapshot mapping,
  empty results, and invalid page/limit handling at the award service boundary.
- Add a static route contract assertion that the new route uses
  `requireParticipant` and does not read `req.query.customerId` or a body
  customer ID.
- Add an opt-in Supabase test-project assertion when the awards table is
  available: two participant identities must receive disjoint award results,
  and the response-equivalent query must preserve snapshot/status fields.
- Run the existing backend unit suite, DB integration suite, and Mini App suite
  unchanged; the Mini App should remain behaviorally untouched in 2B.2.

## Success criteria

- A valid participant token can read only that participant's awards through the
  new endpoint.
- Client-controlled customer identity cannot change the result set.
- Pagination is bounded, deterministic, and exposes `hasMore` correctly.
- Snapshot fields and statuses are mapped without loss or live catalog joins.
- All existing tests pass, and no delivery/spin/UI behavior changes are
  introduced.
