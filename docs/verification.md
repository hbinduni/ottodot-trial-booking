# Verification record

Environment: macOS, Bun 1.4.0. Session date: 7 September 2026 (Asia/Jakarta). Initial implementation/review session: approximately 21:48–22:18 WIB (30 minutes). This is an estimate, not an automated time tracker. Add candidate review and recording time to the final total.

A second session starting at approximately 22:56 WIB refined the UI and repeated browser regression checks. Combined active implementation time is approximately one hour; the idle interval between sessions is excluded.

## Automated checks

- `bun run check:all:fix`: formatting/lint, strict TypeScript, 30 tests with 99 assertions, and Vite production build passed.
- `bun run demo:race`: B confirmed; A refund-required for a full class; exactly four confirmed roster rows.
- Concurrency includes eight independent Bun processes released at a readiness barrier, five concurrent replays of one key, and a real locked-database HTTP 503 path.
- Persistence is verified after closing and reopening the SQLite file.
- An independent backend code review found no actionable defects; its replay-wording clarification was incorporated.
- A clean temporary checkout installed `bun.lock` with `bun install --frozen-lockfile`, passed `bun run check`, and initialized fresh seed data.

## Browser checks

Against the running React UI and Hono API:

- Two-tab last-seat race: Noah confirmed first; Ava became refund-required; the roster contained four children and excluded Ava.
- Failed payment excluded Ava from the Space explorers roster; a new successful attempt confirmed her.
- Duplicate submission reopened the same booking reference.
- Payment-response loss was injected after the server committed. The page retained the request key, survived reload, and recovered the confirmed booking with one payment attempt.
- The production build was served by Hono on port 3000 and showed the persisted booking and payment history, with no console errors.
- At a 390-pixel viewport, page content fit without horizontal overflow.
- Final demo data was restored and read back through the API: Space explorers 1/4 confirmed; Fun with fractions 3/4 confirmed.

After the UI redesign, the following were repeated against a production build with an isolated temporary database, preserving the candidate's current demo data:

- Two-tab last-seat completion, failed-payment retry, duplicate reopening, and lost-response recovery after reload. API readback confirmed one booking per child/class and one attempt for the recovered payment.
- Subject and booking-status filters, separate navigation views, booking URL restoration, and Escape dismissal.
- A failed roster request showed an error while class discovery remained usable; revisiting the roster after network recovery loaded its table.
- Explore classes, My bookings, Teacher roster, and the booking dialog fit a 390-pixel viewport without horizontal overflow.
- A separate UI review found a stale cached count in the roster selector. Removing that count leaves occupancy attached to the freshly fetched roster.

These browser checks were performed using Playwright during development; they are not yet a committed automated end-to-end suite. The repository tests are executable via `bun run check`.

## Submission status

The implementation is published at [hbinduni/ottodot-trial-booking](https://github.com/hbinduni/ottodot-trial-booking). Candidate code review, final personal AI reflection, and the narrated video are not claimed complete by this record. Update the final time total after that work.
