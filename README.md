# Ottodot trial booking

A take-home project for booking children's trial classes. Parents choose a child and a class, try a mock payment, and see whether the booking is confirmed. Teachers can check who's coming, with a maximum of four children in each class.

The main challenge is what happens when two parents want the last seat. This project handles that case alongside duplicate bookings, failed payments, and retries after a lost response.

**[Open the live demo](https://ottodot-trial-booking.lina-duni.workers.dev)** · **[Watch the walkthrough · 7:49](https://ottodot-trial-booking.lina-duni.workers.dev/walkthrough.html)** · [How it works](#how-the-solution-works) · [Run locally](#run-locally) · [Deploy to Cloudflare](#cloudflare-deployment)

Heriyanto narrates the walkthrough in his own voice, with English captions and eight chapters. You can also [download the MP4 from GitHub](https://github.com/hbinduni/ottodot-trial-booking/releases/tag/walkthrough-v3) or [read the transcript](docs/narration.md). See [AI usage](AI_USAGE.md) for the disclosure.

## Try it out

You can open the demo without installing anything or signing in to Cloudflare. The families are made up, and the payment buttons simulate outcomes. No money moves.

1. Choose **Amy Chen** as the demo parent, then select **Ava**.
2. Find a class with room and click **Book trial**.
3. Try a successful or failed payment and read the result in the booking panel.
4. Open **My bookings** to revisit the payment history, or **Teacher roster** to see confirmed learners.

The public demo is shared, so another visitor may have already used a seat or booked a child. Use **Refresh** to pick up changes. For a repeatable walkthrough, run the app locally with the starting data described below.

## Run locally

You'll need [Bun](https://bun.sh/). The project was tested with **Bun 1.4.0**. SQLite runs inside the app, so there's no database server to set up.

From the repository root:

```sh
bun install --frozen-lockfile
bun run dev
```

Open [localhost:5173](http://localhost:5173). The API runs on [localhost:3000](http://localhost:3000/api/health). On first startup, the app creates `data/ottodot.sqlite` and adds the demo families and classes. Your bookings stay there when you restart.

To serve the built frontend and API together, stop the dev servers first, then run:

```sh
bun run build
bun start
```

Open [localhost:3000](http://localhost:3000). For a different database path, host, or API port, copy [.env.example](.env.example) to `.env` and adjust `DATABASE_PATH`, `HOST`, or `PORT`. The dev proxy uses the same API settings. The frontend dev server uses port 5173.

## Scenarios to explore

A fresh database includes these starting points:

| Try this | Starting data |
| --- | --- |
| Book a class with room | Space explorers has Mia confirmed, leaving three seats. |
| Compete for the last seat | Fun with fractions has Eli, Mia, and Zoe confirmed, leaving one seat. |
| Reopen an existing booking | Choose Sample family → Mia → Fun with fractions. You'll get the same confirmed booking. |
| Retry a failed payment | Amy's child Leo has a failed payment for Fun with fractions. Open the booking and try again. |
| Switch between families | Amy has Ava and Leo; Ben has Noah. |

Class dates are set seven and eight days ahead when the database is first seeded. They don't move forward on restart or redeployment.

To start over locally, stop the app and run:

```sh
bun run seed --reset
bun run dev
```

`--reset` deletes the demo records in your configured local database and recreates the starting data. It doesn't reset Cloudflare. Reload any open browser tabs afterward. Running `bun run seed` without `--reset` keeps existing records.

### See the last-seat case

Start with a fresh local database and open two tabs:

1. In tab A, choose **Amy → Ava** and book **Fun with fractions**. Leave the payment pending.
2. In tab B, choose **Ben → Noah** and book the same class.
3. Complete a successful mock payment in tab B. Noah's booking becomes `confirmed`.
4. Complete a successful mock payment in tab A. Ava's booking becomes `refund_required`, with reason `class_full`.
5. Open **Teacher roster → Fun with fractions**. There are four children, including Noah and excluding Ava.

Opening checkout doesn't hold a seat. The first successful payment transaction to claim the remaining seat wins. The other booking records that a refund is needed; it does **not** claim a refund has been issued.

## How the solution works

The browser lets a parent choose a child, open a booking, and submit a mock payment. The server decides whether that payment can confirm a seat. Teachers see the confirmed bookings through a roster query, so there's no separate roster record or background sync to maintain.

### How the pieces fit together

The app uses React and Vite for the frontend, Hono for the API, and SQLite for storage. This is the deployed Cloudflare path:

```mermaid
flowchart TD
    Browser["React app in the browser"]
    Assets["Cloudflare static assets"]
    Worker["Cloudflare Worker"]
    Browser -->|"Load HTML, JavaScript, and CSS"| Assets
    Browser -->|"Send /api/* requests"| Worker
    Worker --> API
    subgraph BookingStore["One Durable Object: ottodot-demo-v1"]
        API["Hono API: validate requests and check demo identity"]
        Service["Booking service: apply booking and payment rules"]
        DB[("Persistent SQLite")]
        API --> Service
        Service --> DB
    end
```

Every parent's API requests reach the same named Durable Object. It owns the database for all demo classes, so competing payments check and claim seats in one shared database. The Worker routes requests; the booking rules run inside the Durable Object.

Locally, Bun runs the same Hono API and booking service against a SQLite file. A small storage interface lets the service use Bun's SQLite connection or Cloudflare's storage adapter. Both versions share the SQL schema and business rules; they have separate databases.

### From choosing a class to joining the roster

1. **Load the choices.** React fetches the demo families, classes, and the selected parent's bookings. Seat counts are snapshots, so the server checks availability again before creating a booking or confirming a payment.
2. **Create or reopen a booking.** **Book trial** opens an existing booking or asks the API to create one. The API checks that the child belongs to the parent and returns any existing child/class booking. A new booking starts as `pending_payment` if the class has room and hasn't started. No seat is reserved yet.
3. **Submit a mock payment.** The parent chooses success or failure. The browser saves a unique request key and that outcome before sending them to the API. This lets it recover the result if the response is lost.
4. **Save the result together.** In one transaction, the service checks the request and saves both the payment attempt and booking status. A failed payment leaves the child unenrolled. A successful payment confirms a seat if there's still room and the class hasn't started; otherwise, it records that a refund is needed.
5. **Refresh the views.** React shows the saved result and reloads availability and booking details. **Teacher roster** queries only confirmed bookings. Another tab picks up changes when it loads or refreshes its data.

### What is stored

| Record | Its role |
| --- | --- |
| `parents` and `students` | Connect each child to the parent who can manage their bookings. |
| `trial_classes` | Store the class title, subject, start time, and capacity of four. |
| `bookings` | Connect one child to one class and store the current booking status. |
| `payment_attempts` | Keep each payment key, mock outcome, resulting status, and any refund reason. A booking can have several attempts after failures. |

Payment history explains **what happened to each request**; the booking tells us **whether the child has a seat now**. Availability is calculated from confirmed bookings, so there's no separate seat counter to keep in sync.

### Booking states

| Status | On the roster? | What it means |
| --- | --- | --- |
| `pending_payment` | No | The booking exists, but no seat is held. |
| `payment_failed` | No | The payment failed. Retry this booking with a new payment key. |
| `confirmed` | Yes | The child has a seat. New payment attempts are rejected. |
| `refund_required` | No | A successful payment arrived after the class filled up or started. A refund is needed but hasn't been issued. |

There is one booking per child and class, across all statuses. Clicking **Book trial** again returns that booking, including after a failed payment. A new payment attempt is attached to that booking; replaying the same request doesn't add another attempt. Confirmed and refund-required bookings are final and don't accept new payments.

### Keeping the last seat safe

The capacity check and payment record happen in one synchronous transaction. Bun uses `BEGIN IMMEDIATE`; Cloudflare uses `storage.transactionSync`.

Within that transaction, the service:

1. Checks that the booking belongs to the selected parent.
2. Looks for an existing payment key and handles a replay or conflicting request.
3. Rejects new payments on a final booking.
4. Checks the class start time against the server clock and counts remaining seats.
5. Updates the booking and saves the payment attempt together.

If saving the attempt fails, the booking update rolls back too. A successful payment only confirms a seat if the class hasn't started and still has room. Otherwise, it records `refund_required` with the appropriate reason.

The database also enforces the rules. Unique constraints prevent duplicate child/class bookings and payment keys. Foreign keys keep records connected, and triggers reject a fifth confirmed child even if a future writer bypasses the service. The roster and its count are read in one transaction, so they describe the same stored state.

The tradeoff is that SQLite serializes writes. The local app must share one database file, and all Cloudflare requests must use the same Durable Object. Splitting storage by parent would let different families claim the same seat.

### Retrying without another payment attempt

Every mock payment request needs an `Idempotency-Key`. Sending the same key with the same booking and outcome returns the stored attempt. Reusing it with different input returns a conflict.

A replay returns **the original payment attempt and the current booking**. For example, an old failed attempt stays failed in the history even if a later retry has confirmed the booking.

Before sending a payment, the browser saves its key and intended outcome in `sessionStorage`. If the response is lost, you can reload and retry that request with its original key. Choosing to try again after a known payment failure uses a new key.

The Bun connection uses foreign keys, WAL mode, and a five-second busy timeout. If the database remains locked, the API returns `503` with `Retry-After: 1`; retry a payment with the same key. Cloudflare manages its own SQLite connections and serializes synchronous work within the Durable Object.

The transaction behavior follows the [Bun SQLite](https://bun.com/docs/runtime/sqlite#transactions) and [Cloudflare SQLite](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) APIs.

### Where to look in the code

| Start here | What you'll find |
| --- | --- |
| [ParentBooking.tsx](web/ParentBooking.tsx) and [PaymentPanel.tsx](web/PaymentPanel.tsx) | The parent flow, payment submission, and recovery after a lost response. |
| [TeacherRoster.tsx](web/TeacherRoster.tsx) | The teacher's view of confirmed learners. |
| [app.ts](server/app.ts) | HTTP routes, request validation, demo identity checks, and error responses. |
| [bookings.ts](server/bookings.ts) | The booking rules, payment transaction, idempotent replay, and roster queries. |
| [schema.sql](server/schema.sql) | Tables, unique constraints, and capacity and booking-state triggers. |
| [server/index.ts](server/index.ts) and [database.ts](server/database.ts) | The local Bun server and SQLite setup. |
| [cloudflare/index.ts](cloudflare/index.ts) and [sql-database.ts](cloudflare/sql-database.ts) | Worker routing, Durable Object initialization, and the Cloudflare storage adapter. |
| [concurrency.test.ts](tests/concurrency.test.ts) and [test-cloudflare.ts](scripts/test-cloudflare.ts) | Evidence for the last-seat race and payment replays across both runtimes. |

## API at a glance

API responses are JSON. Parent-specific routes use `X-Demo-Parent-Id`, such as `parent-amy`. This selects a demo identity; it isn't real authentication. The teacher roster is also public in this demo.

| Method and path | What it does |
| --- | --- |
| `GET /api/health` | Checks that the API can query the database. |
| `GET /api/bootstrap` | Returns the demo parents, children, and classes. |
| `GET /api/classes` | Returns class availability. |
| `POST /api/bookings` | Creates or reopens a booking. Body: `{ "studentId": "student-ava", "classId": "class-space" }`. |
| `GET /api/bookings` | Lists the selected parent's bookings. |
| `GET /api/bookings/:id` | Returns an owned booking and its payment history. |
| `POST /api/bookings/:id/payments` | Records `{"outcome":"succeeded"}` or `{"outcome":"failed"}`. Requires `Idempotency-Key`. |
| `GET /api/classes/:id/roster` | Returns confirmed children and the class count. |

A new booking returns `201`; reopening one returns `200`. Recording a payment also returns `200` when a refund is needed, so callers must read `booking.status` to know the outcome.

Errors use `{ "error": { "code": "...", "message": "..." } }`. Invalid input returns `400`, a missing or unknown demo parent `401`, an unknown or another parent's resource `404`, a conflict `409`, and a body over 8 KiB `413`. Conflicts include full or started classes, mismatched payment keys, and new payments on final bookings.

## Run the checks

```sh
bun run check                    # lint, types, SQLite tests, and frontend build
bun run demo:race                # run the ordered two-parent last-seat example
bun test tests/concurrency.test.ts
bun run test:cloudflare          # test the app in the local Cloudflare runtime
```

The race demo and tests use temporary databases, leaving your development data alone. Eight independent Bun processes compete for the last seat; the test requires one winner and seven refund obligations. Five copies of the same payment key must produce one attempt.

Other tests cover failed-payment retries, duplicates, ownership, invalid input, full and started classes, database constraints, lock contention, and rollback. The Cloudflare suite checks the critical flows in workerd and restarts the runtime to verify persistence.

The [verification notes](docs/verification.md) record these results and the browser checks, including recovery after a deliberately lost response. The browser checks aren't yet a committed end-to-end test suite.

## Cloudflare deployment

### Open the app or manage its deployment

- **[Live app](https://ottodot-trial-booking.lina-duni.workers.dev):** open it directly. No Cloudflare account is needed.
- **[API health](https://ottodot-trial-booking.lina-duni.workers.dev/api/health):** a healthy response is `{"status":"ok","mode":"synthetic-demo"}`.
- **[Cloudflare dashboard](https://dash.cloudflare.com/):** sign in to the owning account and go to **Workers & Pages → ottodot-trial-booking → Deployments** to see versions and their share of traffic.

### Deploy it yourself

Alongside Bun, you'll need Node.js for Wrangler and permission to deploy Workers and SQLite Durable Objects in your Cloudflare account. This setup was tested with **Bun 1.4.0** and **Node.js 24.20.0**.

Run these commands from the repository root:

```sh
bun install --frozen-lockfile

# Sign in through your browser, then check which account you're using.
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID bunx wrangler login
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID bunx wrangler whoami

# Replace this with the account ID returned by whoami.
export CLOUDFLARE_ACCOUNT_ID='<your-account-id>'

bun run check
bun run test:cloudflare
env -u CLOUDFLARE_API_TOKEN bun run deploy:cloudflare
```

The `env -u` commands prevent an existing API token from overriding your browser login. You can reuse that login for later deployments; sign in again if it expires.

The deploy script builds the frontend, uploads the Worker and static files, and sets up the SQLite Durable Object defined in [wrangler.jsonc](wrangler.jsonc). Wrangler prints the public URL and Version ID when it's done. If you deploy to another account, the workers.dev subdomain will be different.

For an update, run the checks and the same deploy command. Keep the Worker name, Durable Object class, and object name unchanged to retain bookings. Pushing to GitHub alone doesn't deploy the app. More detail is in the [Cloudflare runbook](docs/cloudflare.md).

### Check which version is live

Open the Worker's **Deployments** page to see which version is serving traffic. Cloudflare's Version ID is separate from a Git commit SHA. The [deployment guide](docs/cloudflare.md#check-the-deployed-version) includes Wrangler commands, and the [deployment receipt](docs/cloudflare.md#deployment-receipt-8-september-2026) records the versions checked during development.

To preview the Cloudflare version locally, run `bun run dev:cloudflare` and open the URL Wrangler prints.

## What would change for a real product?

The payment endpoint is a mock command. It can record a payment outcome and allocate a seat in one database transaction because it doesn't contact a payment provider. A real charge can't be made atomic with this SQLite transaction.

A real payment flow would verify provider signatures, check amounts and currencies, and store processed event IDs so repeat notifications don't repeat the work. Refunds would need a durable work queue or outbox. Late notifications about actual charges still need to be reconciled, even for a final booking. The mock's rule for rejecting a new payment command isn't enough for a real webhook.

Allocating seats at confirmation avoids abandoned seat holds and expiry jobs, but it means a parent can pay after the class fills. Temporary holds or authorization followed by capture could improve that experience, with extra work for expiry and late events.

The demo also leaves out real parent/teacher authentication, cancellation, re-enrollment, refund execution, emails, background jobs, and regular enrollment. There's no pagination or automatic polling; use **Refresh** when another tab changes a booking.

The next priorities would be authenticated roles, payment reconciliation and refund processing, and automated browser recovery tests. At higher write volume, PostgreSQL with a lock on the relevant class row would allow unrelated classes to handle payments concurrently. Useful operational signals would include unresolved refunds, payment/booking mismatches, capacity violations, lock timeouts, and latency.

## Further reading

| Document | What it covers |
| --- | --- |
| [Cloudflare deployment](docs/cloudflare.md) | Deployment steps, storage behavior, and recorded versions. |
| [Test and verification notes](docs/verification.md) | Automated coverage, browser checks, and their limitations. |
| [Video transcript](docs/narration.md) | The spoken walkthrough, with chapter timestamps. |
| [AI usage](AI_USAGE.md) | AI contributions, candidate decisions, and corrections during development. |

## Time and AI assistance

The project was built with substantial AI assistance. [AI_USAGE.md](AI_USAGE.md) explains what Codex helped with, the candidate's decisions, and corrections made during review.

Before the final documentation cleanup, active work was estimated at **about two and a half hours** across implementation, tests, UI changes, video preparation, and deployment on 7–8 September 2026. This excludes idle time and the candidate's own review; no precise time log was kept. Later edits and review also count toward the task's four-hour limit.
