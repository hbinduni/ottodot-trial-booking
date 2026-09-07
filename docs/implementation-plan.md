# Trial booking implementation plan

**Goal:** Deliver a runnable, persistent trial booking demo with explicit payment and last-seat outcomes.

**Architecture:** Hono request validation delegates to a synchronous SQLite booking service. A React UI consumes typed JSON. SQLite serializes confirmation; constraints defend the roster invariant.

**Stack:** Bun, TypeScript, Hono, SQLite, React, Vite, Biome.

**Spec:** [design.md](design.md)

## Work sequence (maximum four hours)

- [x] Backend (80-minute budget): wrote and ran tests for pending creation, duplicates, failure/retry, payment replay, last-seat ordering, ownership, and SQL constraints. Implemented the SQLite service and seed data.
- [x] API and concurrency (45-minute budget): verified real Hono requests, independent-process contention, one winner, explicit losing outcomes, and exactly four roster rows.
- [x] UI (35-minute budget): implemented and browser-checked selection, success/failure, current status, reload-safe payment keys, and teacher roster.
- [x] Review and submission materials (50-minute budget): passed the quality gate and clean-checkout setup, reviewed the staged diff, wrote documentation and recording guide. Candidate reflection and repository publication remain separate user steps.
- [x] Buffer (30-minute budget): implementation completed within the timebox. Actual initial session was approximately 30 minutes in total; the figures above are allocation ceilings, not claimed time spent.

## Files and interfaces

`openDatabase(filename)` creates a connection with foreign keys, WAL, and a busy timeout; `migrate(db)` applies the versioned schema. `seed(db)` adds synthetic fixtures once. `BookingService` exposes createBooking(parentId, studentId, classId), recordPayment(parentId, bookingId, key, outcome), getBooking(parentId, id), listBookings(parentId), listClasses(), and roster(classId). Payment results contain an immutable attempt outcome plus the current booking. `createApp(db)` provides the HTTP boundary. Tests own their temporary-file cleanup.

## Review checkpoints

No payment service network calls inside a database transaction. No assertion that a pending booking owns a seat. No claimed refund execution. No fabricated human decisions or recording/publication completion in submission docs. No production deployment or unrelated features.
