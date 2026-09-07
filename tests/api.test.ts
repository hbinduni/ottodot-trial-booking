import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createApp } from "../server/app";
import { migrate, openDatabase } from "../server/database";
import { seed } from "../server/seed";

let db: Database;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  seed(db);
  app = createApp(db);
});
afterEach(() => db.close());

const headers = {
  "Content-Type": "application/json",
  "X-Demo-Parent-Id": "parent-amy",
};
const post = (url: string, body: unknown, extra: Record<string, string> = {}) =>
  app.request(url, {
    method: "POST",
    headers: { ...headers, ...extra },
    body: JSON.stringify(body),
  });

test("API creates, confirms, reloads, and exposes the child on the roster", async () => {
  const response = await post("/api/bookings", {
    studentId: "student-ava",
    classId: "class-space",
  });
  expect(response.status).toBe(201);
  const { booking } = await response.json();
  const payment = await post(
    `/api/bookings/${booking.id}/payments`,
    { outcome: "succeeded" },
    { "Idempotency-Key": "api-success" },
  );
  expect(payment.status).toBe(200);
  expect((await payment.json()).booking.status).toBe("confirmed");
  const detail = await app.request(`/api/bookings/${booking.id}`, { headers });
  expect((await detail.json()).paymentAttempts).toHaveLength(1);
  const roster = await app.request("/api/classes/class-space/roster");
  expect(
    (await roster.json()).students.map((s: { name: string }) => s.name),
  ).toEqual(["Ava", "Mia"]);
});

test("duplicate API submission returns 200 and the existing record", async () => {
  const body = { studentId: "student-ava", classId: "class-space" };
  const first = await (await post("/api/bookings", body)).json();
  const duplicate = await post("/api/bookings", body);
  expect(duplicate.status).toBe(200);
  expect((await duplicate.json()).booking.id).toBe(first.booking.id);
});

test("missing and unknown demo identities cannot access parent operations", async () => {
  expect((await app.request("/api/bookings")).status).toBe(401);
  expect(
    (
      await app.request("/api/bookings", {
        headers: { "X-Demo-Parent-Id": "missing" },
      })
    ).status,
  ).toBe(401);
});

test.each(
  [
    null,
    [],
    {},
    { studentId: 1, classId: "class-space" },
    { studentId: " ", classId: "class-space" },
    { studentId: "student-ava", classId: "class-space", status: "confirmed" },
  ].map((body) => ({ body })),
)("invalid booking body cannot create state: %j", async ({ body }) => {
  const response = await post("/api/bookings", body);
  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe("INVALID_INPUT");
});

test("malformed JSON and oversized body produce explicit client errors", async () => {
  const malformed = await app.request("/api/bookings", {
    method: "POST",
    headers,
    body: "{",
  });
  expect(malformed.status).toBe(400);
  expect((await malformed.json()).error.code).toBe("INVALID_JSON");
  const oversized = await post("/api/bookings", {
    studentId: "x".repeat(9000),
    classId: "class-space",
  });
  expect(oversized.status).toBe(413);
});

test("payment requires an idempotency key and a strict mock outcome", async () => {
  const url = "/api/bookings/booking-failed/payments";
  expect((await post(url, { outcome: "failed" })).status).toBe(400);
  expect(
    (
      await post(
        url,
        { outcome: "refunded" },
        { "Idempotency-Key": "bad-outcome" },
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await post(
        url,
        { outcome: "failed", amount: 0 },
        { "Idempotency-Key": "bad-extra" },
      )
    ).status,
  ).toBe(400);
});

test("ownership and unknown classes return structured not-found errors", async () => {
  const response = await post("/api/bookings", {
    studentId: "student-ben",
    classId: "class-space",
  });
  expect(response.status).toBe(404);
  expect((await response.json()).error.code).toBe("STUDENT_NOT_FOUND");
  expect((await app.request("/api/classes/missing/roster")).status).toBe(404);
});

test("health tests a live database and unknown API routes return JSON", async () => {
  expect((await app.request("/api/health")).status).toBe(200);
  const missing = await app.request("/api/no-such-route");
  expect(missing.status).toBe(404);
  expect((await missing.json()).error.code).toBe("NOT_FOUND");
});
