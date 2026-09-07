# Cloudflare deployment

Live demo: [ottodot-trial-booking.lina-duni.workers.dev](https://ottodot-trial-booking.lina-duni.workers.dev).

## Runtime and storage

`wrangler.jsonc` deploys one Worker, `ottodot-trial-booking`, with Vite's `dist` as static assets and `BOOKINGS` bound to the SQLite-backed `BookingDatabase` Durable Object. `/api` and `/api/*` run through the Worker; missing assets return 404.

Every API request uses the stable object name `ottodot-demo-v1`. All parents and classes share that database, including simultaneous requests arriving at different edge locations. Changing the object name creates a different database. Renaming the Worker or Durable Object class can also change storage identity; preserve these names when redeploying.

The booking service uses a small synchronous SQL interface. Bun still uses its native SQLite transactions; the Cloudflare adapter fully consumes SQL cursors and uses `storage.transactionSync` for both write transactions and consistent read snapshots. Cloudflare does not permit SQL `BEGIN`/`COMMIT`. No network call occurs inside a booking transaction.

The first Durable Object initialization installs the existing SQL schema and records schema version 1 in synchronous KV, within one native transaction. Unsupported versions fail startup. The shared seed function runs in its own transaction and checks `app_meta.seed_version`, so retries/restarts do not reset data or duplicate fixtures. Cloudflare owns the connection settings; local WAL/busy-timeout configuration is not applied there. Foreign keys, unique constraints, and capacity triggers remain enforced.

API bodies are buffered at the Worker boundary, with an 8 KiB limit enforced while reading even when Content-Length is absent. This avoids forwarding an unfinished request stream to a Durable Object that may reject the request before reading it. The shared Hono app retains its own body limit. A test covers oversized and chunked requests followed by valid requests.

References: [Cloudflare SQLite storage and transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [Durable Object exports](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/), [static asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/).

## Deploy using a local Wrangler session

Requires Bun 1.4.0 and Node.js supported by the installed Wrangler CLI (verified with Node 24.20.0). Dependencies are installed through Bun. Wrangler's executable runs on Node; the deployed backend runs on Cloudflare's runtime.

```sh
bun install --frozen-lockfile
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID bunx wrangler login
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID bunx wrangler whoami
bun run check
bun run test:cloudflare
# Set this to the intended account returned by whoami before deployment.
export CLOUDFLARE_ACCOUNT_ID='<your-account-id>'
env -u CLOUDFLARE_API_TOKEN bun run deploy:cloudflare
```

The environment token is explicitly unset so it cannot override the local OAuth login. The account ID selects the deployment account; it is not a credential. No credentials are committed. Wrangler creates the Worker, its SQLite Durable Object namespace, and the workers.dev route on first deployment. The `exports` declaration manages the Durable Object class. No custom domain, D1 database, tunnel, or K3s deployment is involved.

Repeat the final command to update the Worker and assets while retaining data. Review schema changes separately; do not delete the Durable Object namespace to fix a code deployment. The local `bun run seed --reset` command affects only the configured Bun database and cannot reset the hosted demo.

## Verification and limitations

`bun run test:cloudflare` starts Wrangler/workerd on a temporary loopback port and temporary storage, exercises the API, then stops and restarts the entire runtime using the same storage. It checks seeds, static assets, JSON/ownership/body errors, duplicate booking, failed-payment retry, five concurrent payment replays, eight payments racing across two parents for one seat, explicit refund obligations, direct SQL constraints, atomic rollback on a forced insert failure, started-class compensation, and persistence/idempotency after restart.

The test config exports a separate fixture subclass with a local SQL-injection endpoint to set up races and force failures. That fixture is not imported by the production entry point and must never be deployed. The normal Worker exposes only the existing app routes; there is no public reset or SQL/admin endpoint.

The public demo is intentionally synthetic and shared. Anyone can select any demo identity or view the teacher roster; these are not real authentication or authorization roles. No real children or payment data should be entered. Payments are mock outcomes and do not move money.

Seats consumed by visitors remain consumed, and dates are fixed seven/eight days after the initial seed. Redeployment preserves those dates and bookings. Use an isolated local reset for a repeatable last-seat demonstration. One Durable Object also serializes unrelated classes; this is suitable for the take-home demo, not a high-volume deployment architecture.

The recorded walkthrough demonstrates the original Bun implementation. Its payment rules and SQL constraints also apply here, but its `BEGIN IMMEDIATE` explanation describes the local runtime; Cloudflare uses the native transaction API described above.

## Deployment receipt, 8 September 2026

- Initial version: `de97d425-1c34-48c8-86b7-2a8e1c502ecc`.
- Verified redeployment: `023c2146-8a3c-4ca6-8375-edb97f627109`.
- Live HTML, JavaScript, CSS, and both illustrations matched the local build byte-for-byte.
- Browser-origin API checks verified duplicate booking, failed payment followed by successful retry, identical-key replay, confirmed-only roster, oversized input rejection, and HTTP 404 for the test SQL endpoint.
- Leo's Space explorers booking and both payment attempts retained their IDs after redeployment; replay still returned the original successful attempt. The live teacher view showed Leo and Mia, 2/4 confirmed. Fun with fractions remained 3/4 confirmed.
- The local 30-test suite, both TypeScript targets, Biome, Vite build, and isolated Cloudflare runtime suite passed. An independent deployment review found no blockers.
