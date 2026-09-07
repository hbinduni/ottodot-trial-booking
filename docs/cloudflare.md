# Deploying to Cloudflare

[Open the live app](https://ottodot-trial-booking.lina-duni.workers.dev) · [Back to the README](../README.md)

The hosted app serves the React frontend and API from one workers.dev address. Bookings live in persistent SQLite storage inside a Durable Object and survive normal redeployments.

## Deploy from your computer

You'll need Bun, Node.js for Wrangler, and a Cloudflare account with permission to deploy Workers and SQLite Durable Objects. This setup was tested with Bun 1.4.0 and Node.js 24.20.0.

Run these commands from the repository root:

```sh
bun install --frozen-lockfile

# Sign in through your browser and check the available accounts.
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID bunx wrangler login
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID bunx wrangler whoami

# Replace this with the account ID you want to deploy to.
export CLOUDFLARE_ACCOUNT_ID='<your-account-id>'

bun run check
bun run test:cloudflare
env -u CLOUDFLARE_API_TOKEN bun run deploy:cloudflare
```

`env -u CLOUDFLARE_API_TOKEN` prevents an existing token from overriding your browser login. You can reuse that login for later deployments. The account ID selects the destination account; it isn't a secret.

The deploy script builds the frontend and uploads the Worker and static files. [wrangler.jsonc](../wrangler.jsonc) defines the Worker, its `BOOKINGS` storage binding, and the Durable Object class. Wrangler prints the public URL and Version ID when deployment finishes. Another account will have a different workers.dev subdomain.

For later updates, run the checks and deploy command again. Pushing to GitHub alone doesn't deploy the app. To preview it locally in Cloudflare's runtime, run `bun run dev:cloudflare` and open the URL Wrangler prints.

## Check the deployed version

In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Workers & Pages → ottodot-trial-booking → Deployments**. You can also use Wrangler with the account selected above:

```sh
env -u CLOUDFLARE_API_TOKEN bunx wrangler deployments list --name ottodot-trial-booking
env -u CLOUDFLARE_API_TOKEN bunx wrangler versions view '<version-id>' --name ottodot-trial-booking
```

Replace `<version-id>` with a version from the deployment list. A Cloudflare Version ID identifies an uploaded version; the deployment shows which version is serving traffic. Neither is a Git commit SHA. See Cloudflare's [versions and deployments guide](https://developers.cloudflare.com/workers/versions-and-deployments/) for details.

The [health endpoint](https://ottodot-trial-booking.lina-duni.workers.dev/api/health) checks that the API can query its database. It returns `{"status":"ok","mode":"synthetic-demo"}` when healthy.

## How storage works

Every `/api` or `/api/*` request reaches the same Durable Object, named `ottodot-demo-v1`. All parents and classes therefore share one database, even when requests arrive at different Cloudflare locations. Keep the Worker name, Durable Object class, and object name unchanged when redeploying so existing bookings remain accessible.

The shared booking service runs through a small storage adapter. Bun uses SQLite's `BEGIN IMMEDIATE`; Cloudflare uses `storage.transactionSync` for writes and consistent read snapshots. The adapter finishes reading each SQL result before returning. There are no network calls inside a booking transaction. See the [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) for the Cloudflare transaction behavior.

On first startup, the Durable Object installs the schema and saves version 1 in the same transaction. An unsupported schema version stops startup. The seed function checks `app_meta.seed_version`, so restarts add no duplicate demo records. Cloudflare manages its own connection settings; the local WAL and busy-timeout settings apply only to Bun. Both runtimes enforce the schema's foreign keys, unique constraints, and capacity triggers.

The Worker reads request bodies before forwarding them, stopping at 8 KiB even without a `Content-Length` header. This prevents a rejected request from leaving an unfinished stream between the Worker and Durable Object. Hono also enforces its own body limit.

## Using the shared demo

The families and payments are made up. Anyone can select a demo parent or view a teacher roster, and no money moves. Bookings made by visitors persist. Class dates are set seven and eight days ahead at the first seed and stay fixed across deployments.

For a repeatable last-seat demonstration, use a fresh local database as described in the [README](../README.md#scenarios-to-explore). `bun run seed --reset` only resets the configured Bun database. Schema changes need a migration; deleting hosted storage is not part of a routine deployment.

One Durable Object serializes writes for all classes. That keeps the demo straightforward, but limits write throughput as usage grows. The video shows the local Bun app; its payment rules also apply here, while its `BEGIN IMMEDIATE` explanation is specific to Bun.

The [Cloudflare test script](../scripts/test-cloudflare.ts) uses temporary storage and a separate test configuration. Its fixture can run SQL to set up races and force failures. That fixture isn't imported by the deployed entry point. The public app has no SQL or reset endpoint. Results are recorded in the [verification notes](verification.md).

## Deployment receipt, 8 September 2026

These are the versions and results recorded during deployment, not a live status report:

| Deployment | Cloudflare Version ID |
| --- | --- |
| Initial app | `de97d425-1c34-48c8-86b7-2a8e1c502ecc` |
| Redeployment used to check persistence | `023c2146-8a3c-4ca6-8375-edb97f627109` |
| Walkthrough player and WebVTT captions | `f509c1cb-59b8-4877-bfae-3075799a6f6e` |
| Revised 7:08 walkthrough and captions | `ec3661d8-e86d-4f44-94bf-447bf44784a5` |

The deployed HTML, JavaScript, CSS, and illustrations matched the local build. Live checks covered duplicate booking, failed-payment retry, payment replay, the confirmed roster, oversized input rejection, and a `404` for the test-only SQL route. Leo's Space explorers booking and both payment-attempt IDs survived redeployment, and replay returned the same successful attempt.

At that check, Space explorers had Mia and Leo confirmed, and Fun with fractions had three confirmed children. Visitors may have changed those counts since then. The revised walkthrough MP4 is hosted in a [GitHub Release](https://github.com/hbinduni/ottodot-trial-booking/releases/tag/walkthrough-v2); only the player and WebVTT captions are Worker assets. The video update preserved the public demo snapshot, and the API health check returned `200`.
