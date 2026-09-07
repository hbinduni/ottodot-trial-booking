import type { BookingStatus, RefundReason } from "../shared/types";

export const statusLabels: Record<BookingStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  payment_failed: "Payment failed",
  refund_required: "Refund required",
};

/** Explain a successful mock payment without promising a seat or a completed refund. */
export function refundMessage(reason: RefundReason): string {
  const explanation =
    reason === "class_started"
      ? "This class started before your payment was recorded."
      : "Another child took the last seat before your payment was recorded.";
  return `${explanation} Your child is not enrolled. A refund is required; it has not been issued. Choose another class or contact the team. This demo moves no real money.`;
}
