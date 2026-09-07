import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { BookingService } from "../server/bookings";
import { migrate, openDatabase } from "../server/database";
import { seed } from "../server/seed";

let db: Database;
let service: BookingService;
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  seed(db);
  service = new BookingService(db);
});
afterEach(() => db.close());

test("pending booking does not enter the roster or consume a seat", () => {
  const { booking, created } = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  );
  expect(created).toBe(true);
  expect(booking.status).toBe("pending_payment");
  expect(service.roster("class-space").students).toHaveLength(1);
});

test("duplicate submissions return the same booking before and after confirmation", () => {
  const first = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  );
  const duplicate = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  );
  expect(duplicate.created).toBe(false);
  expect(duplicate.booking.id).toBe(first.booking.id);
  service.recordPayment(
    "parent-amy",
    first.booking.id,
    "payment-1",
    "succeeded",
  );
  const confirmed = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  );
  expect(confirmed.booking.status).toBe("confirmed");
  expect(service.roster("class-space").students).toHaveLength(2);
});

test("failed payment stays off roster and can retry using a new attempt key", () => {
  const { booking } = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  );
  expect(
    service.recordPayment("parent-amy", booking.id, "failure-1", "failed")
      .booking.status,
  ).toBe("payment_failed");
  expect(service.roster("class-space").students).toHaveLength(1);
  expect(
    service.recordPayment("parent-amy", booking.id, "retry-1", "succeeded")
      .booking.status,
  ).toBe("confirmed");
  expect(
    service.getBooking("parent-amy", booking.id).paymentAttempts,
  ).toHaveLength(2);
});

test("B pays first for last seat; A's later successful payment needs a refund", () => {
  const a = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-fractions",
  ).booking;
  const b = service.createBooking(
    "parent-ben",
    "student-ben",
    "class-fractions",
  ).booking;
  expect(
    service.recordPayment("parent-ben", b.id, "last-b", "succeeded").booking
      .status,
  ).toBe("confirmed");
  const loser = service.recordPayment(
    "parent-amy",
    a.id,
    "last-a",
    "succeeded",
  );
  expect(loser.booking.status).toBe("refund_required");
  expect(loser.attempt.outcome).toBe("succeeded");
  expect(service.roster("class-fractions").students).toHaveLength(4);
  expect(
    service.roster("class-fractions").students.map((s) => s.id),
  ).not.toContain("student-ava");
});

test("payment replay preserves the original attempt and returns current booking state", () => {
  const { booking } = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  );
  const failure = service.recordPayment(
    "parent-amy",
    booking.id,
    "old-failure",
    "failed",
  );
  service.recordPayment("parent-amy", booking.id, "new-success", "succeeded");
  const replay = service.recordPayment(
    "parent-amy",
    booking.id,
    "old-failure",
    "failed",
  );
  expect(replay.replayed).toBe(true);
  expect(replay.attempt).toEqual(failure.attempt);
  expect(replay.booking.status).toBe("confirmed");
  expect(
    service.getBooking("parent-amy", booking.id).paymentAttempts,
  ).toHaveLength(2);
});

test("reusing payment key for different outcome or booking conflicts", () => {
  const a = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  ).booking;
  const b = service.createBooking(
    "parent-amy",
    "student-leo",
    "class-space",
  ).booking;
  service.recordPayment("parent-amy", a.id, "same-key", "failed");
  expect(() =>
    service.recordPayment("parent-amy", a.id, "same-key", "succeeded"),
  ).toThrow("IDEMPOTENCY_CONFLICT");
  expect(() =>
    service.recordPayment("parent-amy", b.id, "same-key", "failed"),
  ).toThrow("IDEMPOTENCY_CONFLICT");
});

test("new payment keys cannot charge a terminal booking again", () => {
  const { booking } = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  );
  service.recordPayment("parent-amy", booking.id, "first", "succeeded");
  expect(() =>
    service.recordPayment("parent-amy", booking.id, "second", "succeeded"),
  ).toThrow("BOOKING_FINAL");
  expect(() =>
    service.recordPayment("parent-amy", booking.id, "third", "failed"),
  ).toThrow("BOOKING_FINAL");
  expect(
    service.getBooking("parent-amy", booking.id).paymentAttempts,
  ).toHaveLength(1);
});

test("ownership checks protect creation, booking details, and payment", () => {
  expect(() =>
    service.createBooking("parent-ben", "student-ava", "class-space"),
  ).toThrow("STUDENT_NOT_FOUND");
  const { booking } = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  );
  expect(() => service.getBooking("parent-ben", booking.id)).toThrow(
    "BOOKING_NOT_FOUND",
  );
  expect(() =>
    service.recordPayment("parent-ben", booking.id, "intruder", "succeeded"),
  ).toThrow("BOOKING_NOT_FOUND");
});

test("full classes reject new bookings while existing duplicates remain retrievable", () => {
  const b = service.createBooking(
    "parent-ben",
    "student-ben",
    "class-fractions",
  ).booking;
  service.recordPayment("parent-ben", b.id, "full", "succeeded");
  expect(() =>
    service.createBooking("parent-amy", "student-ava", "class-fractions"),
  ).toThrow("CLASS_FULL");
  expect(
    service.createBooking("parent-ben", "student-ben", "class-fractions")
      .booking.id,
  ).toBe(b.id);
});

test("started classes reject booking and late successful payment requires refund", () => {
  const a = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  ).booking;
  db.run(
    "UPDATE trial_classes SET starts_at = '2000-01-01T00:00:00.000Z' WHERE id = 'class-space'",
  );
  expect(() =>
    service.createBooking("parent-ben", "student-ben", "class-space"),
  ).toThrow("CLASS_STARTED");
  expect(
    service.recordPayment("parent-amy", a.id, "late", "succeeded").booking
      .status,
  ).toBe("refund_required");
});

test("database rejects duplicate bookings even when bypassing the service", () => {
  expect(() =>
    db.run(
      "INSERT INTO bookings (id, student_id, class_id, status) VALUES ('duplicate', 'student-mia', 'class-fractions', 'pending_payment')",
    ),
  ).toThrow();
});

test("database rejects a fifth confirmed student on inserts and updates", () => {
  const a = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-fractions",
  ).booking;
  const b = service.createBooking(
    "parent-ben",
    "student-ben",
    "class-fractions",
  ).booking;
  service.recordPayment("parent-ben", b.id, "fourth", "succeeded");
  expect(() =>
    db.run("UPDATE bookings SET status = 'confirmed' WHERE id = ?", [a.id]),
  ).toThrow("CLASS_FULL");
  expect(() =>
    db.run(
      "INSERT INTO bookings (id, student_id, class_id, status) VALUES ('fifth', 'student-leo', 'class-fractions', 'confirmed')",
    ),
  ).toThrow("CLASS_FULL");
});

test("payment and enrollment both roll back if persistence fails", () => {
  const { booking } = service.createBooking(
    "parent-amy",
    "student-ava",
    "class-space",
  );
  db.run(
    "CREATE TRIGGER fail_attempt BEFORE INSERT ON payment_attempts BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END",
  );
  expect(() =>
    service.recordPayment("parent-amy", booking.id, "rollback", "succeeded"),
  ).toThrow("simulated disk failure");
  expect(service.getBooking("parent-amy", booking.id).status).toBe(
    "pending_payment",
  );
  expect(service.roster("class-space").students).toHaveLength(1);
  db.run("DROP TRIGGER fail_attempt");
  expect(
    service.recordPayment("parent-amy", booking.id, "rollback", "succeeded")
      .booking.status,
  ).toBe("confirmed");
});

test("seeding twice preserves bookings and the three-confirmed scenario", () => {
  seed(db);
  expect(service.roster("class-fractions").students).toHaveLength(3);
  expect(service.getBooking("parent-amy", "booking-failed").status).toBe(
    "payment_failed",
  );
});
