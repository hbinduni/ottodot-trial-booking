# Video walkthrough and recording guide

[Watch the walkthrough](https://ottodot-trial-booking.lina-duni.workers.dev/walkthrough.html) or [download it from GitHub](https://github.com/hbinduni/ottodot-trial-booking/releases/tag/walkthrough-v1). It runs for 6 minutes 47 seconds and includes captions and chapter navigation. No sign-in is needed.

The candidate requested generated English narration. The video and [transcript](narration.md) disclose the synthetic voice and AI assistance; this is not the candidate speaking. The recording shows the local Bun/SQLite implementation. Cloudflare runs the same booking rules using Durable Object transactions, as explained in the [deployment runbook](cloudflare.md).

The guide below is available if you prefer to record your own explanation, aiming for about 6 minutes 30 seconds. Use it as prompts, and make sure you can explain the transaction and real-payment boundary before the interview.

## Prepare

1. Review `server/bookings.ts`, `server/schema.sql`, and the last-seat tests.
2. Stop the app, run `bun run seed --reset`, then `bun run dev`.
3. Open two tabs at http://localhost:5173. Keep the terminal and source editor ready.
4. Use synthetic records only. Close unrelated tabs and hide notifications.
5. Record with Loom, unlisted YouTube, or your usual recorder. Check audio and link access afterward.

## 0:00–0:40: Scope and decision

Show Explore classes and briefly point out My bookings and Teacher roster. Open the three-of-four fractions roster. Explain that this implements trial booking only and prioritizes backend invariants. State that a pending booking does not own a seat; confirmation happens at payment completion.

## 0:40–1:35: Normal flow, failure, duplicate

In Explore classes, use Amy → Ava → Space explorers → Book trial. Simulate failure and explain that Ava is not enrolled. Retry successfully and show Ava confirmed. Close the panel, open My bookings, and reopen the same booking to show its unchanged reference and payment history. Close the panel before switching to Teacher roster to show Ava.

Explain that booking status is the enrollment result, while payment history records each attempt.

## 1:35–3:05: Required last-seat race

- Tab A: Explore classes → Amy → Ava → Fun with fractions → Book trial.
- Tab B: Explore classes → Ben → Noah → Fun with fractions → Book trial.
- Complete B successfully, then A successfully.
- Show B confirmed and A refund-required. Close the panel, open Teacher roster, and select Fun with fractions to show exactly four children.

Explain that the demo records an obligation to refund, not a completed refund. Neither tab's earlier availability snapshot decides the outcome.

## 3:05–4:20: Backend walkthrough

Open `recordPayment` in `server/bookings.ts`:

- The transaction starts with `BEGIN IMMEDIATE`, so it obtains the write lock before checking capacity.
- Ownership, idempotency, terminal-state checks, capacity/time checks, status update, and attempt insert are inside that transaction.
- Both writes commit or roll back together.

Open `schema.sql`: show unique child/class bookings, capacity triggers for insert/update, and payment-key uniqueness. Explain that SQLite serializes all writers, which is acceptable at this scope but limits unrelated-class concurrency.

## 4:20–5:15: Evidence

Run `bun run check` and `bun run demo:race`. Point out the independent-process test rather than describing `Promise.all` on one synchronous service as concurrency. Mention the rollback test and the browser lost-response recovery check.

Explain why replaying an old failed attempt after a successful retry preserves that old attempt but returns the currently confirmed booking.

## 5:15–6:00: Tradeoffs and production boundary

State what was cut: real authentication, real payments/refunds, cancellation, holds, background jobs, and regular enrollment.

Emphasize that this mock endpoint must not be relabeled as a payment webhook. A real provider needs verified events, amount/currency validation, durable deduplication, and refund reconciliation/outbox work. Consider holds or authorize-then-capture for improved UX; consider PostgreSQL class-row locking when write volume warrants it.

## 6:00–6:30: AI use and follow-up

Explain actual AI usage in your own words, including one genuine correction or rejected suggestion from your review. Mention what you verified yourself and the final time spent. Name the first production concerns to monitor: refund age, payment/enrollment mismatches, and database contention.

## Interview questions to rehearse

- What exactly prevents five students from confirming if there are two server processes?
- What if the server commits but the browser never receives the response?
- Why is a failed attempt separate from the booking's current state?
- Why does a losing successful payment need compensation?
- Why would a real webhook require different terminal-booking handling?
- Why use one booking row for all attempts, and what changes with cancellation?
- When would SQLite stop being a suitable choice?

## Submission checklist

- Review the code and make the personal AI reflection accurate.
- Include total time spent, including your review and recording, within four hours.
- Publish the reviewed code to a public GitHub repository.
- Include a 5–8 minute walkthrough. The published copy uses clearly labeled generated narration; you can replace it with your own recording if preferred.
- Open the repository and video links without signing in to check reviewer access.
- Send both links to Ottodot within five calendar days of the invitation's receipt date. The forwarded brief alone does not establish that receipt date.
