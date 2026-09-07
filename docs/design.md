# Trial booking design

Source: [Ottodot take-home instructions](https://docs.google.com/document/d/1Nt6lDm4KdhoA-Opqk9p30MCRSVUgsYeP/edit), read 7 September 2026.

## Scope and acceptance

One parent chooses their child and a trial class, creates a pending booking, records a mock payment, and sees the outcome. A teacher sees confirmed children only. Capacity is exactly four. Use synthetic seed data, including an available class, a three-confirmed class, an existing booking, and a failed payment. Ship backend and concurrency tests, README, AI usage disclosure, and a 5–8 minute recording guide within a four-hour timebox.

## Decision

Bun + Hono + SQLite with a small React/Vite UI. One local SQLite file is authoritative. SQL remains visible for interview review. No ORM, separate database service, queue, or deployment infrastructure.

Choose confirmation-time allocation. Pending bookings do not reserve seats. Successful mock payment and seat allocation are recorded atomically using `BEGIN IMMEDIATE`. Database triggers also reject a fifth confirmed student. A successful payment with no seat records `refund_required`; the mock does not execute a refund. This accepts compensation work in exchange for no seat-hold expiry workflow. Alternatives: temporary holds improve payment UX but require expiration and late-payment handling; PostgreSQL row locking permits per-class write concurrency but adds reviewer setup.

## Data and transitions

Parents own students. Trial classes have capacity four and a future start time. Bookings are unique per student/class across all statuses; failed payments retry the same booking. Payment attempts record unique request keys, outcome, and resulting booking status. `pending_payment` and `payment_failed` may transition to `confirmed`, `payment_failed`, or `refund_required`. Confirmed and refund-required bookings are terminal in this slice.

Retries of an identical payment key return the original immutable attempt alongside the current booking state. Reusing a key with different input conflicts. A different key against a terminal booking is rejected before simulating another charge. The payment API is a synchronous mock command, not an authenticated payment-provider webhook.

## Boundaries

UI: display availability, disable duplicate clicks, explain final states. Backend: validate input, check demo parent ownership, enforce transitions, serialize confirmation. Database: foreign keys, status checks, booking uniqueness, capacity triggers, payment key uniqueness. Production background work: refund reconciliation and retries; intentionally outside the mock slice.

Demo parent selection is deliberately impersonation, not authentication. All records are synthetic; teacher endpoints are unauthenticated. Real auth, provider verification, refunds, holds, cancellation, and regular enrollment are out of scope.

## Verification

Tests use the real SQLite schema and Hono app. Check failure, duplicate submission, idempotency conflicts/replays, ownership, invalid input, full/started classes, transaction rollback, and constraints bypassing the service. Prove ordered A/B completion and competing OS processes with separate connections to the same file. Browser-check the parent flow, failed-payment retry, terminal states, and roster.

## UI direction

White (#ffffff), pale blue (#edf5fc), navy (#183b56), blue (#1763a6), green (#16634b), and red (#a52a3a). System sans-serif for reliable offline rendering. Left-aligned class list beside a booking panel; roster below. Four visible seat markers explain the domain constraint. No decorative assets or animation.
