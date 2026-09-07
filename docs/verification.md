# Verification record

Environment: macOS, Bun 1.4.0. Session date: 7 September 2026 (Asia/Jakarta). Initial implementation/review session: approximately 21:48–22:18 WIB (30 minutes). This is an estimate, not an automated time tracker. Add candidate review and recording time to the final total.

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

These browser checks were performed using Playwright during development; they are not yet a committed automated end-to-end suite. The repository tests are executable via `bun run check`.

## Submission status

Implementation and the walkthrough guide are local artifacts. Candidate review, the personal AI correction/reflection, repository publication, and the narrated video are not claimed complete by this record. Update the final time total after that work.
