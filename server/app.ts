import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { BookingService } from "./bookings";
import { DomainError } from "./errors";
import { bodyTooLarge, MAX_BODY_BYTES } from "./request-limits";
import type { SqlDatabase } from "./sql-database";

function identifier(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) {
    throw new DomainError(
      "INVALID_INPUT",
      400,
      `${name} must contain 1–100 letters, digits, underscores, or hyphens.`,
    );
  }
  return value;
}

async function jsonBody(
  c: Context,
  fields: string[],
): Promise<Record<string, unknown>> {
  if (
    c.req.header("Content-Type")?.split(";")[0]?.trim().toLowerCase() !==
    "application/json"
  ) {
    throw new DomainError(
      "INVALID_INPUT",
      400,
      "Use Content-Type: application/json.",
    );
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new DomainError(
      "INVALID_JSON",
      400,
      "Request body must be valid JSON.",
    );
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !fields.includes(key))
  ) {
    throw new DomainError(
      "INVALID_INPUT",
      400,
      `Expected an object containing only: ${fields.join(", ")}.`,
    );
  }
  return body as Record<string, unknown>;
}

export function createApp(db: SqlDatabase) {
  const app = new Hono();
  const service = new BookingService(db);
  const parentId = (c: Context) => {
    const id = c.req.header("X-Demo-Parent-Id");
    if (!id || !db.query("SELECT id FROM parents WHERE id = ?").get(id)) {
      throw new DomainError(
        "DEMO_PARENT_REQUIRED",
        401,
        "Select a demo parent using X-Demo-Parent-Id. This is not real authentication.",
      );
    }
    return id;
  };

  app.use(
    "/api/*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json(bodyTooLarge, 413),
    }),
  );
  app.use("/api/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });
  app.get("/api/health", (c) => {
    db.query("SELECT 1").get();
    return c.json({ status: "ok", mode: "synthetic-demo" });
  });
  app.get("/api/bootstrap", (c) => c.json(service.bootstrap()));
  app.get("/api/classes", (c) => c.json(service.listClasses()));
  app.get("/api/classes/:id/roster", (c) =>
    c.json(service.roster(identifier(c.req.param("id"), "classId"))),
  );
  app.get("/api/bookings", (c) => c.json(service.listBookings(parentId(c))));
  app.get("/api/bookings/:id", (c) =>
    c.json(
      service.getBooking(
        parentId(c),
        identifier(c.req.param("id"), "bookingId"),
      ),
    ),
  );
  app.post("/api/bookings", async (c) => {
    const parent = parentId(c);
    const body = await jsonBody(c, ["studentId", "classId"]);
    const result = service.createBooking(
      parent,
      identifier(body.studentId, "studentId"),
      identifier(body.classId, "classId"),
    );
    return c.json(result, result.created ? 201 : 200);
  });
  app.post("/api/bookings/:id/payments", async (c) => {
    const parent = parentId(c);
    const key = identifier(c.req.header("Idempotency-Key"), "Idempotency-Key");
    const body = await jsonBody(c, ["outcome"]);
    if (body.outcome !== "succeeded" && body.outcome !== "failed") {
      throw new DomainError(
        "INVALID_INPUT",
        400,
        "outcome must be succeeded or failed.",
      );
    }
    return c.json(
      service.recordPayment(
        parent,
        identifier(c.req.param("id"), "bookingId"),
        key,
        body.outcome,
      ),
    );
  });
  app.onError((error, c) => {
    if (error instanceof DomainError)
      return c.json(
        { error: { code: error.code, message: error.detail } },
        error.httpStatus,
      );
    if (
      "code" in error &&
      (error.code === "SQLITE_BUSY" ||
        error.code === "SQLITE_BUSY_SNAPSHOT" ||
        error.code === "SQLITE_LOCKED")
    ) {
      c.header("Retry-After", "1");
      return c.json(
        {
          error: {
            code: "DATABASE_BUSY",
            message:
              "Database is busy. Retry this request using the same payment key.",
          },
        },
        503,
      );
    }
    console.error("Unexpected API error", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            "The request could not be completed. Retry a payment with its original key.",
        },
      },
      500,
    );
  });
  app.notFound((c) =>
    c.json(
      { error: { code: "NOT_FOUND", message: "Endpoint not found." } },
      404,
    ),
  );
  return app;
}
