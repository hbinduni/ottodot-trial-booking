# Ottodot walkthrough: Heriyanto's voice

Narrated by Heriyanto Binduni using the eight supplied recordings. Captions are lightly edited for readability and technical spelling. Screen footage shows synthetic families and mock payments.

## 00:00:00 Introduction and design choices

Hello, my name is Heriyanto. I will walk through the trial-class booking solution and explain the main decisions, especially what happens when two parents compete for the last seat. The app was built using React and Hono at the backend, and we use SQLite for the DB. Why? Because that keeps the project very small, with the booking rules in one service and the important constraints in the database. A parent can choose a child, book a trial, and simulate the payment. The teacher dashboard will show the confirmed children only, where each class has four places. The screen recording uses synthetic families, and all the payments are mocked.

## 00:01:01 Booking, failure, and retry

OK, here, creating a booking will give a pending-payment status. It doesn't reserve a seat, and I chose to allocate the seat when a successful payment is processed. If payment fails, the child stays off this roster, and the same booking can be retried. A successful retry will check availability again before confirming. Reopening this child and class returns the existing booking. The database enforces one booking per child and class. Payment attempts are separate records, so a failed attempt remains in the history even after the booking becomes confirmed.

## 00:01:52 The last-seat scenario

This class starts with three confirmed children, so one seat remains. Parent A opens a booking first but doesn't pay. Parent B then opens another booking and completes the successful mock payment first. B's child gets the final seat. When A's successful payment is processed, the class is already full. The result is refund required, and A's child is excluded from the roster. The roster still contains exactly four children. I chose this outcome because payment success and enrollment success are separate facts. Recording a refund obligation preserves that distinction. It does not claim that a refund has been issued. A temporary seat hold is another option, but would need expiry and late-payment rules.

## 00:02:55 Why the race is safe

The critical detail is where the capacity check happens. Locally, the service starts an immediate SQLite write transaction before reading the number of confirmed bookings. SQLite allows one writer at a time. If B gets the transaction first, B can read three confirmed bookings and confirm the fourth. A must wait to acquire its write transaction. After B commits, A reads four, so A cannot also take that seat. If the database remains busy, the API returns a retryable error. The booking update and payment-attempt insert are inside the same transaction. They commit together, or both roll back if an operation fails. Capacity triggers also reject a fifth confirmed booking on insert or update. That protects against a future writer bypassing the service. Disabling a button in React shouldn't protect against another browser or process.

## 00:04:05 Recovering an uncertain payment

Another failure case is losing the response after the server commits. The browser cannot assume that means the payment failed. Before sending the request, it saves a unique payment key and the intended outcome in session storage. If the response is uncertain, it keeps that key. Retrying the same command returns the original attempt without recording another one. Using the key with different input returns a conflict. The replay check happens before rejecting a final booking, so a lost confirmation response can still be recovered. This solves repeated commands. The transaction handles competition for capacity. They solve different problems.

## 00:04:55 Evidence from tests

The concurrency test starts eight independent processes, each with its own connection to the same SQLite database. They wait behind a readiness barrier, and then compete for one remaining seat. The test checks one confirmation, seven refund obligations, and a roster of four. Another test sends five concurrent copies of one payment key, and checks that only one attempt is stored. There are also tests for an insert failure rolling back the booking update, full and started classes, duplicate bookings, and ownership checks. These exercise the important failure paths, although they aren't a production load benchmark.

## 00:05:46 Cloudflare storage

The hosted version uses a Cloudflare Worker for the frontend and routes API requests to one shared SQLite backend called a Durable Object. It runs the same booking service and schema. The storage mechanism is different from Bun. The adapter uses Cloudflare's native synchronous transaction API to keep the database operations together and roll them back on an exception. All parents share that object because they compete for the same class capacity. One database per parent would break that coordination. A single shared object is simple for the demo, but also limits write throughput.

## 00:06:34 Production boundaries and closing

For real use, I would add trusted authentication and verified payment-provider events, like using Google auth, and then we put the webhook to verify the payment when the payment returns success from a provider like Midtrans and others, including amount and currency checks. Refunds would need execution and reconciliation. Provider network calls should stay outside the short database transaction. I used Codex extensively for the implementation and testing, and directed the product and delivery choices. The repository documents that assistance under the AI guidance. The main decisions are to confirm seats automatically, preserve payment history, and make uncertain requests safe to retry. That keeps the roster correct while making unsuccessful enrollment explicit, and prevents more complications. Thank you for reviewing my solution.
