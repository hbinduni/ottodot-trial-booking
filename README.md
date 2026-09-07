# Ottodot trial booking

A small, persistent trial booking demo. Parents choose a child and a class, record a mock payment, and see the booking outcome. The teacher roster includes confirmed children only, with a hard limit of four per class.

**Try the deployed app:** [Open Ottodot on Cloudflare](https://ottodot-trial-booking.lina-duni.workers.dev). No installation or Cloudflare login is needed. Select a demo parent and child to try bookings; all identities and payments are synthetic.

The main decision: **a pending booking does not reserve a seat**. The first successful payment transaction to secure the last seat confirms; another successful payment records a refund obligation and never enters the roster.

## Run locally

Requires [Bun](https://bun.sh/) **1.4.0** (the version used for verification). No separate database server is needed.

```sh
bun install --frozen-lockfile
bun run dev
```

Open [localhost:5173](http://localhost:5173). The API runs at [localhost:3000](http://localhost:3000/api/health). Startup creates and seeds `data/ottodot.sqlite` once. Changes survive restarts.

To run the production frontend build and API together:

```sh
bun run build
bun start
```

Then open [localhost:3000](http://localhost:3000). Stop the dev servers first so port 3000 is available. Run commands from the repository root.

Optional configuration is documented in [.env.example](.env.example). Copy it to `.env` to override `DATABASE_PATH`, `HOST`, or `PORT`. Defaults are a local data file and loopback-only listeners. Invalid API port/path values fail startup. The dev proxy reads the same API host and port. Vite uses port 5173 and fails if it is occupied.

## Cloudflare deployment

### Access the deployed app

- [Live app](https://ottodot-trial-booking.lina-duni.workers.dev): Explore classes, My bookings, and Teacher roster.
- [API health](https://ottodot-trial-booking.lina-duni.workers.dev/api/health): returns `{"status":"ok","mode":"synthetic-demo"}` when the API and database are available.
- [Cloudflare dashboard](https://dash.cloudflare.com/): sign in to the owning account, then open **Workers & Pages → ottodot-trial-booking → Deployments** to inspect deployed versions and their traffic allocation. Dashboard access requires account permissions; the live app is public.

The public demo shares its synthetic bookings across visitors. Seats and class dates persist between visits and deployments. Use fresh local seed data for repeatable interview scenarios.

### Deploy or update the app

Requires Bun **1.4.0**, Node.js supported by Wrangler (verified with **24.20.0**), and a Cloudflare account with permission to deploy Workers and SQLite Durable Objects. Run these commands from the repository root:

```sh
bun install --frozen-lockfile

# Authorize the local Wrangler session and confirm the account.
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID bunx wrangler login
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID bunx wrangler whoami

# Replace the placeholder with the intended account ID returned by whoami.
export CLOUDFLARE_ACCOUNT_ID='<your-account-id>'

# Validate both runtimes, then build and publish the complete app.
bun run check
bun run test:cloudflare
env -u CLOUDFLARE_API_TOKEN bun run deploy:cloudflare
```

Unset `CLOUDFLARE_API_TOKEN` so an existing environment token cannot override the browser-authorized Wrangler session. For later updates, reuse the session and account selection; run `wrangler login` again if the session expires.

The deploy script builds the Vite frontend, uploads its static assets and Worker, and configures the SQLite Durable Object declared in [wrangler.jsonc](wrangler.jsonc). Wrangler prints the workers.dev URL and a **Version ID** after deployment. Another account gets its own workers.dev subdomain. Git pushes update the repository; deployment is performed explicitly with the command above.

Reusing the same Worker name, Durable Object class, and object name preserves hosted bookings. `bun run seed --reset` resets only the local Bun database. See the [storage lifecycle and deployment runbook](docs/cloudflare.md) before changing those identities or the schema.

### Inspect the deployed version

With the account selected above, inspect Cloudflare's deployment history and a specific version:

```sh
env -u CLOUDFLARE_API_TOKEN bunx wrangler deployments list --name ottodot-trial-booking
env -u CLOUDFLARE_API_TOKEN bunx wrangler versions view '<version-id>' --name ottodot-trial-booking
```

Use the latest deployment's version and traffic allocation to identify what is serving the live URL. A Cloudflare Version ID identifies a Worker artifact; it is separate from a Git commit SHA. The [dated deployment receipt](docs/cloudflare.md#deployment-receipt-8-september-2026) records the versions verified for this submission. See Cloudflare's [versions and deployments guide](https://developers.cloudflare.com/workers/versions-and-deployments/) for the dashboard workflow.

For a local preview of the Cloudflare target:

```sh
bun run dev:cloudflare   # build frontend and run the Worker locally
```

Open the local URL printed by Wrangler. The Cloudflare target shares the HTTP handlers, booking rules, SQL schema, and seeds with the Bun target; [runtime differences](docs/cloudflare.md#runtime-and-storage) are documented in the runbook.

## Verify

```sh
bun run check          # lint, strict types, real-database tests, production build
bun run demo:race      # deterministic A/B scenario through the HTTP handlers
bun test tests/concurrency.test.ts
```

The race demo uses an isolated temporary database and leaves your UI data untouched. The concurrency tests start separate OS processes with separate SQLite connections to one file. A readiness barrier releases all writers together; assertions require exactly one winner and explicit refund obligations for every loser. Another test races five copies of the same payment request and requires one stored attempt.

The suite also covers duplicate creation before/after payment, failed payment and retry, conflicting idempotency keys, terminal-state protection, foreign child access, full/started classes, malformed input, direct SQL constraint violations, lock contention, persistence after reopen, and atomic rollback when payment recording fails. See [verification notes](docs/verification.md) for browser checks.

## Seed scenarios

| Scenario | Data / action |
| --- | --- |
| Seats available | Space explorers starts with Mia confirmed: 1 of 4 occupied. |
| Last seat | Fun with fractions starts with Eli, Mia, and Zoe confirmed: 3 of 4 occupied. |
| Duplicate attempt | Choose Sample family → Mia → Fun with fractions. Opening the existing booking returns the same confirmed record. |
| Failed payment | Amy Chen's child Leo already has a failed payment for Fun with fractions. Open it and retry, or simulate a failure on a new booking. |
| Two parents | Amy Chen owns Ava and Leo; Ben Lim owns Noah. |

Class dates are generated seven/eight days ahead when seeding. To repeat a scenario, stop the app and run:

```sh
bun run seed --reset
bun run dev
```

`--reset` deletes all demo records in the configured database and recreates the synthetic fixtures. Without `--reset`, `bun run seed` preserves existing records. Reload browser tabs after resetting.

## Last-seat walkthrough

1. Start with fresh seed data. Open the UI in two tabs.
2. In tab A, choose Amy → Ava in **Explore classes**, then **Book trial** on Fun with fractions.
3. In tab B, choose Ben → Noah, then **Book trial** on Fun with fractions.
4. Complete B's successful mock payment. B becomes `confirmed`.
5. Complete A's successful mock payment. A becomes `refund_required`, reason `class_full`.
6. Close the booking panel, open **Teacher roster**, and select Fun with fractions. It has exactly four children, including Noah and excluding Ava.

The winner is whichever transaction acquires the database write lock and commits first. Starting checkout earlier confers no priority. Seat availability on screen is advisory and may be stale; use **Refresh data** to reload other tabs' changes.

## App navigation

- **Explore classes:** select a child, filter by subject, and open a trial booking. Four seat markers show the latest loaded availability.
- **My bookings:** view all family bookings or filter to confirmed bookings and those needing attention. Reopen a booking to see its payment history or retry a failed attempt.
- **Teacher roster:** choose a class to load its confirmed learners and occupancy together.

The responsive sidebar becomes top navigation on smaller screens. A keyboard-accessible booking dialog keeps payment and status in context; its URL restores the open booking after reload. Demo parent selection and outstanding payment requests are stored per browser tab. The parent/teacher views are navigation boundaries, not authorization.

## Backend design

### Data model

- `parents` and `students`: each student belongs to one parent.
- `trial_classes`: title, subject, UTC start time, capacity constrained to exactly four.
- `bookings`: one row per `(student_id, class_id)`, status, timestamps, foreign keys.
- `payment_attempts`: booking, unique idempotency key, mock outcome, resulting booking status, optional refund reason, timestamp. Retries append a new attempt only when they use a new key on an eligible booking.
- `app_meta`: records seed initialization. Bun uses `PRAGMA user_version` for schema version; Cloudflare stores it in the same Durable Object's synchronous KV storage.

See [schema.sql](server/schema.sql) and [bookings.ts](server/bookings.ts). SQL parameters are bound rather than interpolated from requests. Roster rows and counts are read in one snapshot.

### Booking states

| State | On roster? | Next action |
| --- | --- | --- |
| `pending_payment` | No | Submit a mock payment. No seat is held. |
| `payment_failed` | No | Retry the same booking with a new payment-attempt key. |
| `confirmed` | Yes | Terminal in this slice. Duplicate creation returns this booking. |
| `refund_required` | No | Terminal in this slice. Successful payment needs compensation; no refund has been executed. |

Both pending and failed bookings can accept an attempt. A failed result sets `payment_failed`. A successful result sets `confirmed` only if the class has not started and capacity remains; otherwise it sets `refund_required`. Refused new attempts against terminal bookings do not simulate another charge.

### Atomic confirmation and duplicates

`recordPayment` runs a synchronous transaction: `BEGIN IMMEDIATE` on Bun, or native `storage.transactionSync` on Cloudflare:

1. Check booking ownership and look for the idempotency key.
2. Replay an identical stored attempt, or reject conflicting reuse.
3. Reject new attempts on terminal bookings.
4. Read class time and confirmed count while holding the write lock.
5. Update booking status and insert the payment attempt.
6. Commit both changes, or roll both back on error.

SQLite allows one writer at a time. Acquiring the write lock before reading capacity prevents two writers from both observing the last seat as available. Database triggers independently reject a fifth confirmed row on insertion or update. A unique `(student_id, class_id)` constraint blocks duplicates, including concurrent creation. Duplicate creation returns HTTP 200 with the existing record; new creation returns 201.

This deliberately uses a stronger uniqueness rule than “one confirmed booking”: one booking per child/class for its entire lifetime. Failed payments retry that row. Cancellation, re-enrollment, and booking identity changes are outside scope.

The Bun connection uses foreign keys, WAL mode, and a five-second busy timeout. Lock contention returns HTTP 503 with `Retry-After: 1`; payment callers must retain their original key. Cloudflare manages its SQLite connections and serializes synchronous work within the shared Durable Object. A lost response also requires retrying the original key. The browser stores outstanding requests in `sessionStorage` before sending, including their intended outcome, and offers recovery after reload.

A replay returns **the original attempt plus the current booking**. For example, replaying an old failure after a later successful retry returns a failed historical attempt and a currently confirmed booking. This avoids rewriting history or downgrading current UI status.

Reference behavior: [SQLite transactions](https://www.sqlite.org/lang_transaction.html), [Bun SQLite transactions](https://bun.com/docs/runtime/sqlite#transactions), and [SQLite triggers](https://www.sqlite.org/lang_createtrigger.html).

### API

All responses are JSON. Parent-scoped routes require `X-Demo-Parent-Id`; this is explicit demo impersonation, not authentication. Errors have `{ "error": { "code": "...", "message": "..." } }`.

| Method / path | Purpose |
| --- | --- |
| `GET /api/health` | Check the database connection. |
| `GET /api/bootstrap` | Synthetic parents, children, and classes for demo selection. |
| `GET /api/classes` | Class availability snapshot. |
| `POST /api/bookings` | Body: `{ "studentId": "student-ava", "classId": "class-space" }`. |
| `GET /api/bookings` | Current demo parent's bookings. |
| `GET /api/bookings/:id` | Owned booking plus payment history. |
| `POST /api/bookings/:id/payments` | Body: `{ "outcome": "succeeded" }` or `failed`; requires `Idempotency-Key`. |
| `GET /api/classes/:id/roster` | Confirmed children only, plus the class count. |

Payment results use 200 even when the resulting booking needs a refund: the mock result was recorded successfully, and clients must inspect `booking.status`. Conflicting key reuse, new payments on terminal bookings, and unavailable new bookings use 409. Invalid input uses 400, oversized bodies 413, unknown/foreign resources 404, and absent/unknown demo parents 401.

### Responsibility boundaries

| Layer | Checks and responsibilities |
| --- | --- |
| UI | Selection, duplicate-click prevention, approximate availability, current status, payment-key recovery. |
| Backend | Strict JSON input, demo ownership, transition eligibility, started-class checks, atomic seat allocation, idempotency semantics. |
| Database | Foreign keys, status consistency within payment rows, unique child/class booking and payment key, capacity on insert/update, immutable booking identity and terminal status. |
| Background work, in a real system | Retry/refund reconciliation, alerting on unresolved compensation, stale pending cleanup. Not implemented in this mock. |

### Payment boundary and tradeoffs

This endpoint is a **synchronous mock payment command**, not a real provider webhook. No provider is contacted, and no money moves. Recording the mock success and enrollment decision can therefore be one local transaction.

A real payment cannot be made atomic with SQLite this way. I would use server-created payment attempts, provider idempotency keys, verified signed events, amount/currency checks, durable event deduplication, and an outbox for refund work. Late/duplicate provider events must be recorded and reconciled, including extra charges against already terminal bookings. The mock's “reject a new command before charging” rule must not be copied into a webhook handler that receives evidence of an existing charge.

Confirmation-time allocation avoids abandoned seat holds and expiry jobs. It accepts worse UX for a parent who pays after the class fills; the refund obligation is explicit. Temporary holds or provider authorization followed by capture are reasonable alternatives, but still need late-event and compensation handling. SQLite's single writer also serializes unrelated classes. At higher write volume, I would use PostgreSQL and lock the relevant class row within the same transaction.

## Assumptions, cuts, and next steps

- All data is synthetic. Demo identity selection and teacher access are public by design; there is no production authorization, real PII, payment processor, or charge amount.
- No regular enrollment, cancellation, refunds execution, seat holds, email, or background jobs.
- No pagination or automatic polling for this small dataset. Parents explicitly refresh when another tab changes state.
- Start-time eligibility is checked at the confirmation decision using server time. Class scheduling/rescheduling is not exposed.
- The Bun target requires a shared local database file. The Cloudflare target routes all demo classes and parents to one stable Durable Object. Separate files or separate object identities do not share capacity; do not scale by copying or partitioning the database by parent.
- The public demo has shared, finite state. Other visitors can use its synthetic identities and consume its seats. Seeds run once; class dates do not move forward on redeploy. Repeatable interview scenarios can always be run locally with fresh seeds.

After release I would monitor confirmed count violations, duplicate/constraint conflicts, payment-to-confirmation conversion, failed payments, refund-required count and age, provider/local mismatches, lock timeouts, and latency. Never log payment credentials or unnecessary child data.

With more time: authenticated parent/teacher roles; a real payment adapter with event reconciliation and refund outbox; PostgreSQL load tests; automated browser recovery tests; accessibility checks; and product decisions for cancellation, refunds, and abandoned checkouts.

## Time and submission notes

Time spent so far: **approximately two and a quarter hours** of active AI-assisted implementation, UI refinement, documentation, verification, generated-video preparation, and Cloudflare deployment on 7–8 September 2026. This is an estimate across working sessions, excluding idle intervals. Add candidate review and any further recording/editing time to the final four-hour total. See [verification.md](docs/verification.md).

See [AI_USAGE.md](AI_USAGE.md) for tool use and corrections, and [the walkthrough guide](docs/walkthrough.md) for a 5–8 minute recording plan.

A [narration transcript](docs/narration.md) accompanies the generated-voice walkthrough. Video binaries are kept outside Git; the submission needs a separately accessible video link.
