# Ottodot narrated walkthrough

Generated English voice: Microsoft Andrew Neural. Screen interactions are automated against an isolated synthetic database. Review before submitting.

## 00:00:00 — Scope and app navigation

Welcome to this walkthrough of the Ottodot trial booking project. This video uses generated English narration and automated screen capture. The application runs with React, a Hono API, and a persistent SQLite database. A parent can choose a child, book a trial, and record a mock payment. Teachers see confirmed learners only. The central rule is that each trial class has at most four confirmed students.

## 00:00:28 — Create a booking and handle failure

Starting with Amy and her child Ava, the Space explorers class has seats available. Book trial opens a pending booking. At this point, no seat is reserved and Ava is not on the teacher roster. The simulator makes success and failure easy to demonstrate. Choosing a failed payment records the attempt and keeps Ava unenrolled. The interface explains that she can retry the same booking.

## 00:00:54 — Retry, confirm, and reopen

A successful retry checks availability again and confirms Ava. The booking now has one failed attempt and one successful attempt in its history. Closing the panel and opening the same class returns the existing booking reference. My bookings provides the same record. The distinction matters: booking status describes the current enrollment, while payment history preserves what happened during each attempt.

## 00:01:21 — Last-seat race: parent A starts first

Now for the required last-seat scenario. Fun with fractions starts with three confirmed children and just one seat available. Amy starts a booking for Ava but does not complete payment. This is parent A. Opening checkout does not give A priority. The displayed availability is only a snapshot. A different parent can still complete a successful payment and claim that final seat before A does.

## 00:01:47 — Parent B completes first

In a separate browser session, Ben chooses Noah and starts a booking for the same fractions class. This is parent B. Both bookings are pending, but there is still only one available seat. Ben completes the successful mock payment first. Noah becomes confirmed. The server makes this decision inside a database transaction, so the later payment must observe the capacity after Noah has taken the seat.

## 00:02:13 — Parent A needs compensation

Returning to Amy, the successful mock payment is now recorded after the class has filled. Ava receives refund required instead of confirmed. The message explicitly says that a refund has not been issued and Ava is not enrolled. Opening the teacher roster shows exactly four children: Eli, Mia, Noah, and Zoe. Ava is excluded. Payment success and successful enrollment are separate outcomes when capacity has run out.

## 00:02:43 — Recover a lost payment response

Another important failure happens when the server commits but the browser loses the response. Here, the recording deliberately drops a payment response after the server records success. The interface keeps the original request key and offers recovery. Reloading preserves both the booking and that key. Retrying the same request recovers the confirmed result with one recorded payment attempt. This avoids guessing whether an uncertain payment should be sent again as a new charge.

## 00:03:15 — Atomic confirmation in SQLite

The core logic is in recordPayment. The immediate transaction acquires the database write lock before reading class capacity. It checks ownership, looks for an existing payment key, and rejects new commands for terminal bookings. It then checks the class start time and remaining seats, updates the booking, and inserts the payment attempt. Both writes commit together or roll back together. SQLite serializes writers, including separate processes using the same database file.

## 00:03:47 — Database constraints protect the rules

The schema provides a second line of defense. A unique constraint permits one booking per child and class across all statuses. Failed payments therefore retry the existing row. Payment keys are also unique. Capacity triggers reject a fifth confirmed booking on either insertion or update, even if a future writer bypasses the service. Foreign keys preserve relationships, and explicit status checks prevent inconsistent payment outcomes. Confirmed and refund required are terminal in this slice.

## 00:04:21 — Idempotency preserves history

An identical payment key replays the original attempt alongside the current booking state. Reusing that key with another booking or a different outcome returns a conflict. There is a subtle case worth explaining: an old failed attempt can be replayed after a later successful retry. The old attempt must stay failed, but the booking must remain confirmed. The browser displays those two facts separately. A different key against a terminal booking is refused before another mock payment is recorded.

## 00:04:54 — Verification and concurrency evidence

The repository check passes formatting and lint rules, strict TypeScript checks, thirty tests with ninety nine assertions, and the production build. The concurrency test starts eight independent Bun processes with separate database connections. A readiness barrier releases them together. Exactly one wins the last seat and seven require refunds. Another test sends five concurrent copies of the same key and records one attempt. Additional tests cover ownership, invalid input, started classes, database lock errors, persistence, and atomic rollback.

## 00:05:32 — Tradeoffs and production boundaries

This is a synchronous mock payment command, not a real provider webhook. No real money moves. A production payment integration would need verified provider events, amount and currency checks, durable event deduplication, and refund reconciliation. Network calls must stay outside the database lock. Temporary holds or authorization before capture could improve the last-seat experience. At higher write volume, PostgreSQL could lock individual class rows. Authentication, cancellation, and refund execution remain outside this take-home slice.

## 00:06:10 — AI use and final review

Codex assisted with architecture, implementation, tests, illustrations, and this walkthrough. The candidate accepted confirmation-time allocation and requested a more complete app interface after the first version. A separate review caught a stale roster count, which was corrected. These contributions are documented in the AI usage file. The public repository includes setup instructions, seed scenarios, and the verification record. The candidate should review the code and narration before submitting and be ready to explain these decisions independently.
