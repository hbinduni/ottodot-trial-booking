import worker, { BookingDatabase } from "../../cloudflare/index";

// This entry point is used only by the isolated local runtime tests.
export class TestBookingDatabase extends BookingDatabase {
  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/api/__test/sql") {
      const { sql, bindings = [] } = (await request.json()) as {
        sql: string;
        bindings?: (string | number | null)[];
      };
      try {
        return Response.json(
          this.ctx.storage.sql.exec(sql, ...bindings).toArray(),
        );
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 400 });
      }
    }
    return super.fetch(request);
  }
}

export default worker;
