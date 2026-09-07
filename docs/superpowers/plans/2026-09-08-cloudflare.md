# Cloudflare deployment implementation plan

> For agentic workers: execute inline using the executing-plans workflow. Keep the existing Bun app and the new Cloudflare target independently verifiable.

**Goal:** Publish the complete synthetic trial-booking app to the candidate's personal Cloudflare account with persistent, transactional storage.

**Architecture:** Workers static assets serve the Vite build. `/api/*` requests use one stable Durable Object identity containing SQLite. A small synchronous database interface allows the existing Hono routes, booking service, schema, and seeds to run on either Bun SQLite or Durable Object storage. Transactions remain synchronous; no network operations enter the confirmation transaction.

**Tech Stack:** Existing Bun/Hono/React/Vite, Wrangler, Workers, SQLite-backed Durable Objects.

**Spec:** This deployment request and `docs/design.md` define the scope. The local implementation remains supported. The recorded walkthrough describes that local implementation; Cloudflare runtime differences must be documented.

## Constraints

- Preserve the existing development SQLite file and all current demo bookings.
- Use the verified personal Cloudflare account. Default to its workers.dev hostname unless the candidate provides a custom domain.
- Do not modify other Workers, domains, tunnels, or K3s workloads.
- One stable object ID must contain all demo parents and classes. Parent-specific objects would incorrectly partition seat capacity.
- Use `transactionSync` for Cloudflare transactions; Cloudflare SQL does not accept `BEGIN`/`COMMIT` statements.
- Keep the API and payment/idempotency contracts unchanged. Deploy synthetic seed data only.

## Steps

- [x] Verify Workers authentication through the existing Wrangler OAuth login; read the account subdomain and existing Worker names before creating a new Worker.
- [x] Add a Worker-runtime acceptance test that exercises fresh seeds, duplicate booking, failure/retry, competing last-seat payments, idempotent replays, and persistence after restarting the local runtime. Observe its failure before adding the entry point.
- [x] Introduce `server/sql-database.ts` with the query/run/transaction surface used by the shared service. Change only type imports in shared API, service, and seed code; retain native Bun behavior and the 30-test suite.
- [x] Implement `cloudflare/sql-database.ts` using fully consumed SQL cursors and `transactionSync`. Implement `cloudflare/index.ts` with transactional schema initialization, seeding, one stable object name, API forwarding, and static assets.
- [x] Configure Wrangler, separate Worker type checking, local state exclusions, and reproducible build/test/deploy commands. Do not commit credentials.
- [x] Run the existing gate plus the Cloudflare runtime tests. Verify rollback, constraints, JSON errors, and missing assets as well as successful requests.
- [x] Review the deployment diff and document runtime/storage differences and the live-demo shared-state limitation.
- [x] Deploy to Cloudflare, verify the public HTML/assets/API and live booking behavior, then verify stored results survive a new deployment. Leave a usable synthetic demo.

Delivery: commit and push the verified changes; report the live URL and exact deployment evidence in the final handoff. The deployment receipt is in `docs/cloudflare.md`.
