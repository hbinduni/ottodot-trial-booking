import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app";
import { migrate, openDatabase } from "../server/database";
import { seed } from "../server/seed";

const directory = mkdtempSync(join(tmpdir(), "ottodot-demo-"));
const db = openDatabase(join(directory, "demo.sqlite"));
try {
  migrate(db);
  seed(db);
  const app = createApp(db);
  async function post(
    parentId: string,
    url: string,
    body: unknown,
    key?: string,
  ) {
    const response = await app.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Demo-Parent-Id": parentId,
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    return result;
  }
  const a = await post("parent-amy", "/api/bookings", {
    studentId: "student-ava",
    classId: "class-fractions",
  });
  const b = await post("parent-ben", "/api/bookings", {
    studentId: "student-ben",
    classId: "class-fractions",
  });
  console.log("A and B both reach payment. Pending bookings reserve no seats.");
  const winner = await post(
    "parent-ben",
    `/api/bookings/${b.booking.id}/payments`,
    { outcome: "succeeded" },
    "demo-b",
  );
  const loser = await post(
    "parent-amy",
    `/api/bookings/${a.booking.id}/payments`,
    { outcome: "succeeded" },
    "demo-a",
  );
  console.log(`B completes first: ${winner.booking.status}`);
  console.log(
    `A completes later: ${loser.booking.status} (${loser.attempt.refundReason})`,
  );
  const roster = await (
    await app.request("/api/classes/class-fractions/roster")
  ).json();
  console.table(roster.students);
  if (
    winner.booking.status !== "confirmed" ||
    loser.booking.status !== "refund_required" ||
    roster.students.length !== 4
  )
    throw new Error("Last-seat invariant failed");
  console.log(
    "PASS: exactly four confirmed students. A is excluded; mock refund obligation is recorded.",
  );
  console.log(
    "Run bun test tests/concurrency.test.ts for simultaneous, independent-process contention.",
  );
} finally {
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
