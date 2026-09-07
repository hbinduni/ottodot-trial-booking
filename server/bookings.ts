import type { Database } from "bun:sqlite";
import type {
  Booking,
  BookingDetails,
  Bootstrap,
  PaymentAttempt,
  PaymentOutcome,
  PaymentResult,
  RefundReason,
  Roster,
  TrialClass,
} from "../shared/types";
import { DomainError } from "./errors";

const bookingSelect = `SELECT b.id, b.student_id AS studentId, b.class_id AS classId,
  s.name AS studentName, c.title AS classTitle, b.status, b.created_at AS createdAt,
  b.updated_at AS updatedAt FROM bookings b
  JOIN students s ON s.id = b.student_id JOIN trial_classes c ON c.id = b.class_id`;
const attemptSelect = `SELECT id, booking_id AS bookingId, idempotency_key AS idempotencyKey,
  outcome, resulting_status AS resultingStatus, refund_reason AS refundReason,
  created_at AS createdAt FROM payment_attempts`;
const classSelect = `SELECT c.id, c.title, c.subject, c.starts_at AS startsAt, c.capacity,
  COUNT(b.id) AS confirmedCount, c.capacity - COUNT(b.id) AS availableSeats
  FROM trial_classes c LEFT JOIN bookings b ON b.class_id = c.id AND b.status = 'confirmed'`;

export class BookingService {
  constructor(private db: Database) {}

  bootstrap(): Bootstrap {
    return {
      parents: this.db
        .query<Bootstrap["parents"][number], []>(
          "SELECT id, name FROM parents ORDER BY id",
        )
        .all(),
      students: this.db
        .query<Bootstrap["students"][number], []>(
          "SELECT id, parent_id AS parentId, name FROM students ORDER BY name",
        )
        .all(),
      classes: this.listClasses(),
    };
  }

  listClasses(): TrialClass[] {
    return this.db
      .query<TrialClass, []>(
        `${classSelect} GROUP BY c.id ORDER BY c.starts_at, c.id`,
      )
      .all();
  }

  private getClass(id: string): TrialClass {
    const trialClass = this.db
      .query<TrialClass, [string]>(
        `${classSelect} WHERE c.id = ? GROUP BY c.id`,
      )
      .get(id);
    if (!trialClass)
      throw new DomainError("CLASS_NOT_FOUND", 404, "Trial class not found.");
    return trialClass;
  }

  listBookings(parentId: string): Booking[] {
    return this.db
      .query<Booking, [string]>(
        `${bookingSelect} WHERE s.parent_id = ? ORDER BY b.created_at DESC, b.id`,
      )
      .all(parentId);
  }

  private ownedBooking(parentId: string, id: string): Booking {
    const booking = this.db
      .query<Booking, [string, string]>(
        `${bookingSelect} WHERE b.id = ? AND s.parent_id = ?`,
      )
      .get(id, parentId);
    if (!booking)
      throw new DomainError(
        "BOOKING_NOT_FOUND",
        404,
        "Booking not found for this parent.",
      );
    return booking;
  }

  getBooking(parentId: string, id: string): BookingDetails {
    return this.db
      .transaction(() => ({
        ...this.ownedBooking(parentId, id),
        paymentAttempts: this.db
          .query<PaymentAttempt, [string]>(
            `${attemptSelect} WHERE booking_id = ? ORDER BY rowid`,
          )
          .all(id),
      }))
      .deferred();
  }

  createBooking(
    parentId: string,
    studentId: string,
    classId: string,
  ): { booking: Booking; created: boolean } {
    return this.db
      .transaction(() => {
        const student = this.db
          .query("SELECT id FROM students WHERE id = ? AND parent_id = ?")
          .get(studentId, parentId);
        if (!student)
          throw new DomainError(
            "STUDENT_NOT_FOUND",
            404,
            "Choose a child belonging to this parent.",
          );
        const existing = this.db
          .query<Booking, [string, string]>(
            `${bookingSelect} WHERE b.student_id = ? AND b.class_id = ?`,
          )
          .get(studentId, classId);
        if (existing) return { booking: existing, created: false };
        const trialClass = this.getClass(classId);
        if (Date.parse(trialClass.startsAt) <= Date.now())
          throw new DomainError(
            "CLASS_STARTED",
            409,
            "This class has already started.",
          );
        if (trialClass.availableSeats === 0)
          throw new DomainError(
            "CLASS_FULL",
            409,
            "This class has no available seats.",
          );
        const id = crypto.randomUUID();
        this.db.run(
          "INSERT INTO bookings (id, student_id, class_id, status) VALUES (?, ?, ?, 'pending_payment')",
          [id, studentId, classId],
        );
        return { booking: this.ownedBooking(parentId, id), created: true };
      })
      .immediate();
  }

  recordPayment(
    parentId: string,
    bookingId: string,
    key: string,
    outcome: PaymentOutcome,
  ): PaymentResult {
    // This is a mock payment command. Never put a real provider network call inside this lock.
    return this.db
      .transaction(() => {
        const booking = this.ownedBooking(parentId, bookingId);
        const previous = this.db
          .query<PaymentAttempt, [string]>(
            `${attemptSelect} WHERE idempotency_key = ?`,
          )
          .get(key);
        if (previous) {
          if (
            previous.bookingId !== bookingId ||
            previous.outcome !== outcome
          ) {
            throw new DomainError(
              "IDEMPOTENCY_CONFLICT",
              409,
              "This payment key was already used with different input.",
            );
          }
          return { booking, attempt: previous, replayed: true };
        }
        if (
          booking.status === "confirmed" ||
          booking.status === "refund_required"
        ) {
          throw new DomainError(
            "BOOKING_FINAL",
            409,
            "This booking has a final result; no further mock payment was recorded.",
          );
        }
        const trialClass = this.getClass(booking.classId);
        let refundReason: RefundReason = null;
        if (outcome === "succeeded") {
          if (Date.parse(trialClass.startsAt) <= Date.now())
            refundReason = "class_started";
          else if (trialClass.availableSeats === 0) refundReason = "class_full";
        }
        const resultingStatus =
          outcome === "failed"
            ? "payment_failed"
            : refundReason
              ? "refund_required"
              : "confirmed";
        this.db.run(
          "UPDATE bookings SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
          [resultingStatus, bookingId],
        );
        const id = crypto.randomUUID();
        this.db.run(
          "INSERT INTO payment_attempts (id, booking_id, idempotency_key, outcome, resulting_status, refund_reason) VALUES (?, ?, ?, ?, ?, ?)",
          [id, bookingId, key, outcome, resultingStatus, refundReason],
        );
        const attempt = this.db
          .query<PaymentAttempt, [string]>(`${attemptSelect} WHERE id = ?`)
          .get(id);
        if (!attempt) throw new Error("Payment insert returned no row");
        return {
          booking: this.ownedBooking(parentId, bookingId),
          attempt,
          replayed: false,
        };
      })
      .immediate();
  }

  roster(classId: string): Roster {
    // Count and roster must describe the same snapshot if another connection confirms a seat.
    return this.db
      .transaction(() => ({
        trialClass: this.getClass(classId),
        students: this.db
          .query<
            Roster["students"][number],
            [string]
          >(`SELECT s.id, s.name, b.id AS bookingId
        FROM bookings b JOIN students s ON s.id = b.student_id
        WHERE b.class_id = ? AND b.status = 'confirmed' ORDER BY s.name, s.id`)
          .all(classId),
      }))
      .deferred();
  }
}
