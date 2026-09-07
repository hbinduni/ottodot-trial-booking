import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BookingService } from "../server/bookings";
import { migrate, openDatabase } from "../server/database";
import { seed } from "../server/seed";
import type { PaymentResult } from "../shared/types";

async function race(
  filename: string,
  requests: { parentId: string; bookingId: string; key: string }[],
) {
  const workers = requests.map((request) => {
    const ready = Promise.withResolvers<void>();
    const process = Bun.spawn(
      [
        Bun.which("bun") ?? "bun",
        new URL("./helpers/payment-worker.ts", import.meta.url).pathname,
        filename,
        request.parentId,
        request.bookingId,
        request.key,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
        ipc(message) {
          if (message === "ready") ready.resolve();
        },
      },
    );
    void process.exited.then(() =>
      ready.reject(new Error("Worker exited before barrier")),
    );
    return { process, ready: ready.promise };
  });
  try {
    await Promise.all(workers.map((worker) => worker.ready));
    for (const worker of workers) worker.process.send("go");
    return await Promise.all(
      workers.map(async (worker) => {
        const [code, output, errors] = await Promise.all([
          worker.process.exited,
          new Response(worker.process.stdout).text(),
          new Response(worker.process.stderr).text(),
        ]);
        expect({ code, errors }).toEqual({ code: 0, errors: "" });
        return JSON.parse(output) as PaymentResult | { error: string };
      }),
    );
  } finally {
    for (const worker of workers) worker.process.kill();
  }
}

test("eight independent processes compete for one seat; one confirms and seven require refunds", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ottodot-race-"));
  const filename = join(directory, "race.sqlite");
  const db = openDatabase(filename);
  try {
    migrate(db);
    seed(db);
    const service = new BookingService(db);
    const requests = Array.from({ length: 8 }, (_, i) => {
      const parentId = `race-parent-${i}`;
      const studentId = `race-student-${i}`;
      db.run("INSERT INTO parents (id, name) VALUES (?, ?)", [
        parentId,
        parentId,
      ]);
      db.run("INSERT INTO students (id, parent_id, name) VALUES (?, ?, ?)", [
        studentId,
        parentId,
        studentId,
      ]);
      return {
        parentId,
        bookingId: service.createBooking(parentId, studentId, "class-fractions")
          .booking.id,
        key: `race-key-${i}`,
      };
    });
    const results = await race(filename, requests);
    expect(
      results.filter((r) => "booking" in r && r.booking.status === "confirmed"),
    ).toHaveLength(1);
    expect(
      results.filter(
        (r) => "booking" in r && r.booking.status === "refund_required",
      ),
    ).toHaveLength(7);
    expect(service.roster("class-fractions").students).toHaveLength(4);
    expect(
      db
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM payment_attempts WHERE idempotency_key LIKE 'race-key-%'",
        )
        .get()?.count,
    ).toBe(8);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 15000);

test("concurrent retries of one payment key record exactly one attempt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ottodot-retry-"));
  const filename = join(directory, "race.sqlite");
  const db = openDatabase(filename);
  try {
    migrate(db);
    seed(db);
    const service = new BookingService(db);
    const booking = service.createBooking(
      "parent-amy",
      "student-ava",
      "class-space",
    ).booking;
    const results = await race(
      filename,
      Array.from({ length: 5 }, () => ({
        parentId: "parent-amy",
        bookingId: booking.id,
        key: "shared-key",
      })),
    );
    expect(
      results.filter((r) => "booking" in r && r.booking.status === "confirmed"),
    ).toHaveLength(5);
    expect(results.filter((r) => "replayed" in r && r.replayed)).toHaveLength(
      4,
    );
    expect(
      service.getBooking("parent-amy", booking.id).paymentAttempts,
    ).toHaveLength(1);
    db.close();
    const reopened = openDatabase(filename);
    try {
      expect(
        new BookingService(reopened).getBooking("parent-amy", booking.id)
          .status,
      ).toBe("confirmed");
    } finally {
      reopened.close();
    }
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 15000);

test("lock contention returns a retryable API error without creating a booking", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ottodot-busy-"));
  const filename = join(directory, "busy.sqlite");
  const db = openDatabase(filename);
  migrate(db);
  seed(db);
  const lock = openDatabase(filename);
  try {
    db.run("PRAGMA busy_timeout = 1");
    lock.run("BEGIN IMMEDIATE");
    const { createApp } = await import("../server/app");
    const response = await createApp(db).request("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Demo-Parent-Id": "parent-amy",
      },
      body: JSON.stringify({
        studentId: "student-ava",
        classId: "class-space",
      }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect((await response.json()).error.code).toBe("DATABASE_BUSY");
    expect(new BookingService(db).listBookings("parent-amy")).toHaveLength(1);
  } finally {
    lock.run("ROLLBACK");
    lock.close();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
