import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  Booking,
  BookingDetails,
  Bootstrap,
  PaymentResult,
  Roster,
} from "../shared/types";

const directory = await mkdtemp(join(tmpdir(), "ottodot-workerd-"));
const probe = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => new Response(),
});
const port = probe.port;
probe.stop(true);
const base = `http://127.0.0.1:${port}`;
let process: Bun.Subprocess<"ignore", "pipe", "pipe"> | undefined;
let logs: Promise<string> | undefined;

async function start() {
  const testEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(Bun.env)) {
    if (typeof value === "string") testEnv[key] = value;
  }
  process = Bun.spawn(
    [
      "bunx",
      "wrangler",
      "dev",
      "--config",
      "tests/cloudflare/wrangler.jsonc",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--inspector-port",
      "0",
      "--persist-to",
      directory,
      "--show-interactive-dev-session=false",
    ],
    {
      env: { ...testEnv, CI: "true", WRANGLER_SEND_METRICS: "false" },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  logs = Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]).then((parts) => parts.join("\n"));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null)
      throw new Error(`Wrangler exited: ${await logs}`);
    try {
      const response = await fetch(`${base}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.status === 200 && (await response.json()).status === "ok")
        return;
    } catch {
      /* The runtime is still starting. */
    }
    await Bun.sleep(200);
  }
  throw new Error(
    "Cloudflare runtime did not become healthy within 30 seconds",
  );
}

async function stop() {
  if (!process) return;
  process.kill("SIGTERM");
  await process.exited;
  process = undefined;
}

async function request<T>(
  path: string,
  body?: unknown,
  key?: string,
  parent = "parent-amy",
  expected = 200,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Parent-Id": parent,
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`);
  return value as T;
}
const sql = (
  statement: string,
  bindings: (string | number | null)[] = [],
  expected = 200,
) =>
  request<Record<string, unknown>[]>(
    "/api/__test/sql",
    { sql: statement, bindings },
    undefined,
    "parent-amy",
    expected,
  );
const book = (
  studentId: string,
  classId: string,
  parent = "parent-amy",
  expected = 201,
) =>
  request<{ booking: Booking }>(
    "/api/bookings",
    { studentId, classId },
    undefined,
    parent,
    expected,
  );
const pay = (
  id: string,
  key: string,
  outcome = "succeeded",
  parent = "parent-amy",
  expected = 200,
) =>
  request<PaymentResult>(
    `/api/bookings/${id}/payments`,
    { outcome },
    key,
    parent,
    expected,
  );

try {
  await start();
  const initial = await request<Bootstrap>("/api/bootstrap");
  assert.equal(initial.classes.length, 2);
  assert.equal(
    initial.classes.find((c) => c.id === "class-fractions")?.confirmedCount,
    3,
  );
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
  await request("/api/unknown", undefined, undefined, "parent-amy", 404);
  await request("/api/bookings", undefined, undefined, "unknown", 401);
  await book("student-ben", "class-space", "parent-amy", 404);
  await request(
    "/api/bookings",
    { studentId: "x".repeat(9000) },
    undefined,
    "parent-amy",
    413,
  );
  for (const [text, expected] of [
    ["x".repeat(9000), 413],
    ["{}", 401],
  ] as const) {
    const response = await fetch(`${base}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text.slice(0, 4500)));
          controller.enqueue(new TextEncoder().encode(text.slice(4500)));
          controller.close();
        },
      }),
    });
    assert.equal(response.status, expected);
    assert.equal(
      (await response.json()).error.code,
      expected === 413 ? "BODY_TOO_LARGE" : "DEMO_PARENT_REQUIRED",
    );
    assert.equal(
      (await request<{ status: string }>("/api/health")).status,
      "ok",
    );
  }
  console.log(
    "PASS: real Worker, static assets, seed data, JSON errors, ownership and body limit",
  );

  const { booking } = await book("student-ava", "class-space");
  assert.equal(
    (await book("student-ava", "class-space", "parent-amy", 200)).booking.id,
    booking.id,
  );
  assert.equal(
    (await pay(booking.id, "failed", "failed")).booking.status,
    "payment_failed",
  );
  const copies = await Promise.all(
    Array.from({ length: 5 }, () => pay(booking.id, "retry")),
  );
  assert.equal(copies.filter((result) => !result.replayed).length, 1);
  assert(copies.every((result) => result.booking.status === "confirmed"));
  assert.equal(new Set(copies.map((result) => result.attempt.id)).size, 1);
  const history = await request<BookingDetails>(`/api/bookings/${booking.id}`);
  assert.equal(history.paymentAttempts.length, 2);
  const oldFailure = await pay(booking.id, "failed", "failed");
  assert.equal(oldFailure.attempt.resultingStatus, "payment_failed");
  assert.equal(oldFailure.booking.status, "confirmed");
  await pay(booking.id, "retry", "failed", "parent-amy", 409);
  await pay(booking.id, "extra-charge", "succeeded", "parent-amy", 409);
  console.log(
    "PASS: duplicate booking, failure/retry, five concurrent replays, historical replay and terminal protection",
  );

  const competitors = [];
  for (let i = 0; i < 8; i++) {
    await sql("INSERT INTO students (id, parent_id, name) VALUES (?, ?, ?)", [
      `racer-${i}`,
      i % 2 ? "parent-ben" : "parent-amy",
      `Racer ${i}`,
    ]);
    const parent = i % 2 ? "parent-ben" : "parent-amy";
    competitors.push({
      ...(await book(`racer-${i}`, "class-fractions", parent)),
      parent,
    });
  }
  const race = await Promise.all(
    competitors.map((entry, i) =>
      pay(entry.booking.id, `race-${i}`, "succeeded", entry.parent),
    ),
  );
  assert.equal(
    race.filter((result) => result.booking.status === "confirmed").length,
    1,
  );
  assert.equal(
    race.filter(
      (result) =>
        result.booking.status === "refund_required" &&
        result.attempt.refundReason === "class_full",
    ).length,
    7,
  );
  const roster = await request<Roster>("/api/classes/class-fractions/roster");
  assert.equal(roster.students.length, 4);
  assert.equal(roster.trialClass.confirmedCount, 4);
  await sql(
    "INSERT INTO bookings (id, student_id, class_id, status) VALUES ('fifth', 'student-ben', 'class-fractions', 'confirmed')",
    [],
    400,
  );
  await sql(
    "INSERT INTO students (id, parent_id, name) VALUES ('orphan', 'missing', 'Orphan')",
    [],
    400,
  );
  console.log(
    "PASS: eight competing payments across parents, exactly one winner, seven refund obligations, capacity and foreign-key constraints",
  );

  const pending = (await book("student-leo", "class-space")).booking;
  await sql(
    "CREATE TRIGGER force_failure BEFORE INSERT ON payment_attempts WHEN NEW.idempotency_key = 'rollback' BEGIN SELECT RAISE(ABORT, 'TEST_INSERT_FAILURE'); END",
  );
  await pay(pending.id, "rollback", "succeeded", "parent-amy", 500);
  const rolledBack = await request<BookingDetails>(
    `/api/bookings/${pending.id}`,
  );
  assert.equal(rolledBack.status, "pending_payment");
  assert.equal(rolledBack.paymentAttempts.length, 0);
  await sql("DROP TRIGGER force_failure");
  await sql(
    "UPDATE trial_classes SET starts_at = '2000-01-01T00:00:00.000Z' WHERE id = 'class-space'",
  );
  const late = await pay(pending.id, "rollback");
  assert.equal(late.booking.status, "refund_required");
  assert.equal(late.attempt.refundReason, "class_started");
  console.log(
    "PASS: payment insert failure rolls back booking and attempt; same key can retry; late success requires refund",
  );

  await stop();
  await start();
  assert.deepEqual(
    await request<BookingDetails>(`/api/bookings/${booking.id}`),
    history,
  );
  assert.deepEqual(
    await request<Roster>("/api/classes/class-fractions/roster"),
    roster,
  );
  assert.equal((await pay(pending.id, "rollback")).replayed, true);
  assert.deepEqual(
    (await request<Bootstrap>("/api/bootstrap")).parents,
    initial.parents,
  );
  console.log(
    "PASS: database, attempts, roster and idempotency survive full runtime restart without reseeding",
  );
} catch (error) {
  await stop();
  console.error(await logs);
  throw error;
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
