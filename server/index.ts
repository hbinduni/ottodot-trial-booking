import { serveStatic } from "hono/bun";
import { createApp } from "./app";
import { databasePath, serverAddress } from "./config";
import { migrate, openDatabase } from "./database";
import { seed } from "./seed";

const db = openDatabase(databasePath());
migrate(db);
seed(db);
const app = createApp(db);
app.get("/assets/*", serveStatic({ root: "./dist" }));
app.get("/", serveStatic({ path: "./dist/index.html" }));
const server = Bun.serve({ ...serverAddress(), fetch: app.fetch });
console.log(`Ottodot synthetic demo: ${server.url}`);

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await server.stop();
  db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
