export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "payment_failed"
  | "refund_required";
export type PaymentOutcome = "succeeded" | "failed";
export type RefundReason = "class_full" | "class_started" | null;
export interface Parent {
  id: string;
  name: string;
}
export interface Student {
  id: string;
  parentId: string;
  name: string;
}
export interface TrialClass {
  id: string;
  title: string;
  subject: string;
  startsAt: string;
  capacity: number;
  confirmedCount: number;
  availableSeats: number;
}
export interface Booking {
  id: string;
  studentId: string;
  classId: string;
  studentName: string;
  classTitle: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}
export interface PaymentAttempt {
  id: string;
  bookingId: string;
  idempotencyKey: string;
  outcome: PaymentOutcome;
  resultingStatus: Exclude<BookingStatus, "pending_payment">;
  refundReason: RefundReason;
  createdAt: string;
}
export interface BookingDetails extends Booking {
  paymentAttempts: PaymentAttempt[];
}
export interface PaymentResult {
  booking: Booking;
  attempt: PaymentAttempt;
  replayed: boolean;
}
export interface Roster {
  trialClass: TrialClass;
  students: { id: string; name: string; bookingId: string }[];
}
export interface Bootstrap {
  parents: Parent[];
  students: Student[];
  classes: TrialClass[];
}
