# Test and verification notes

These results were recorded during development on 7–8 September 2026, using macOS and Bun 1.4.0. They describe checks already performed, not a live health report. To repeat the automated checks, run the commands below from the repository root.

## Automated checks

| Command | Recorded result |
| --- | --- |
| `bun run check` | Biome, both TypeScript targets, 30 tests with 99 assertions, and the Vite build passed. |
| `bun run demo:race` | Parent B confirmed first. Parent A received `refund_required` for the full class. The roster contained exactly four children. |
| `bun run test:cloudflare` | The API and storage checks passed in the local Cloudflare runtime, including a full restart using the same stored data. |

A clean temporary checkout also installed dependencies with `bun install --frozen-lockfile`, passed `bun run check`, and created the expected starting data. Tests and race scripts use temporary databases, leaving development bookings alone.

### The last seat and repeated requests

The [Bun concurrency tests](../tests/concurrency.test.ts) start eight independent processes with separate connections to one SQLite file. They wait until every process is ready, then release them together. Exactly one payment takes the last seat; the other seven require refunds. Five concurrent copies of one payment key produce one stored attempt.

The Cloudflare suite checks the same outcomes with eight competing payments across two parents and five repeated requests. Both runtimes also check that a booking update rolls back if saving its payment attempt fails.

### Other failure cases

The suites cover duplicate bookings, failed-payment retries, final booking states, conflicting payment keys, another parent's resources, invalid input, full and started classes, and database constraints. Bun tests include a locked database returning HTTP `503`, and persistence after reopening the file. Cloudflare tests include oversized fixed-length and chunked bodies, valid requests after rejected input, and payment replay after restarting the runtime.

## Browser checks

Playwright was used during development against the running React app and API. These checks are documented here; they aren't yet a committed end-to-end test suite.

| Scenario | Observed result |
| --- | --- |
| Two parents compete for the last seat | Noah confirmed first; Ava needed a refund. The roster had four children and excluded Ava. |
| Failed payment followed by a retry | Ava stayed off the roster after failure and appeared after a successful retry. |
| Reopen a booking | The same booking reference and payment history were shown. |
| Lose the response after the server commits | Reloading preserved the request key. Retrying recovered confirmation with one payment attempt. |
| Navigation and filters | Class and booking filters worked; the booking URL reopened its panel; Escape closed the dialog. |
| Roster request fails | An error appeared while class discovery remained usable. Returning after network recovery loaded the roster. |
| Narrow screen | The class list, booking history, roster, and dialog fit a 390-pixel viewport without horizontal overflow. |

The core flows were repeated after the interface redesign using an isolated database. A separate UI review caught a stale count in the roster selector; occupancy now comes from the fetched roster response. The built app also showed persisted booking history when served by Hono on port 3000, without console errors.

## Hosted app

Cloudflare checks confirmed duplicate booking, failed-payment retry, request replay, and the teacher roster. A second deployment preserved the booking and payment-attempt IDs. Built assets matched local SHA-256 digests, and the test-only SQL endpoint returned `404`.

The deployed bundle contained neither the test fixture nor Bun's SQLite import. The [deployment receipt](cloudflare.md#deployment-receipt-8-september-2026) records the version IDs and the data observed at the time. A separate Codex review found no deployment blockers.

## Walkthrough video

The revised [walkthrough](https://ottodot-trial-booking.lina-duni.workers.dev/walkthrough.html) runs for 7 minutes 8 seconds at 1920 × 1080, with H.264 video and AAC audio. It retains the first 12 chapters of app interactions, code, test output, and tradeoffs. The final chapter explains the Cloudflare deployment, discloses AI assistance, and summarizes the completed solution.

The revision uses the same generated English voice. All 83 caption cues were checked for order and timing. The complete MP4 decoded without errors, and frames from the new ending were inspected for legibility. Browser checks against a local preview confirmed playback, seeking to the final chapter, caption loading, and layouts at desktop and 390-pixel widths without page errors or horizontal overflow.

The repository gate passed again after the update: 30 tests, 99 assertions, both TypeScript targets, Biome, and the frontend build. The transcript, player duration, chapter timestamps, and caption file were updated together. The original caption asset remains available for browsers with a cached copy of the previous player.

The revised MP4 is 19,118,169 bytes. Its SHA-256 is:

```text
324af5007823679d3fd0aaf4beb3ad6d3218b6c2b74c6ac50f4f7dd23c2fbf5d
```

The MP4, SRT captions, and checksums are distributed as [GitHub Release assets](https://github.com/hbinduni/ottodot-trial-booking/releases/tag/walkthrough-v2). Cloning the repository doesn't download the video or require Git LFS. The [transcript](narration.md) is included in the repository. The [original release](https://github.com/hbinduni/ottodot-trial-booking/releases/tag/walkthrough-v1) remains available.
