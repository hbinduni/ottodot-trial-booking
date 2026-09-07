import { DurableObject } from "cloudflare:workers";
import { createApp } from "../server/app";
import schema from "../server/schema.sql";
import { seed } from "../server/seed";
import { bufferApiRequest } from "./request";
import { DurableSqlDatabase } from "./sql-database";

interface Env {
  BOOKINGS: DurableObjectNamespace<BookingDatabase>;
  ASSETS: Fetcher;
}

export class BookingDatabase extends DurableObject<Env> {
  private readonly app: ReturnType<typeof createApp>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.transactionSync(() => {
      const version = ctx.storage.kv.get<number>("schema_version");
      if (version === 1) return;
      if (version !== undefined)
        throw new Error(`Unsupported schema version: ${version}`);
      ctx.storage.sql.exec(schema).toArray();
      ctx.storage.kv.put("schema_version", 1);
    });
    const db = new DurableSqlDatabase(ctx.storage);
    seed(db);
    this.app = createApp(db);
  }

  override async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      const buffered = await bufferApiRequest(request);
      if (buffered instanceof Response) return buffered;
      // This stable name owns all demo classes. Changing it creates a new database;
      // partitioning by parent would break shared class capacity.
      return env.BOOKINGS.getByName("ottodot-demo-v1").fetch(buffered);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
