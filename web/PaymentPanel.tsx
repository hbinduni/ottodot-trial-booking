import { useState } from "react";
import type {
  BookingDetails,
  PaymentOutcome,
  PaymentResult,
} from "../shared/types";
import { ApiError, api, errorMessage, parentHeaders } from "./api";
import { refundMessage, statusLabels } from "./status-message";

interface OutstandingPayment {
  key: string;
  outcome: PaymentOutcome;
}
function outstandingPayment(storageKey: string): OutstandingPayment | null {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (
      typeof saved === "object" &&
      saved !== null &&
      "key" in saved &&
      typeof saved.key === "string" &&
      "outcome" in saved &&
      (saved.outcome === "succeeded" || saved.outcome === "failed")
    )
      return { key: saved.key, outcome: saved.outcome };
  } catch {
    /* Invalid local draft is not a payment result. */
  }
  sessionStorage.removeItem(storageKey);
  return null;
}

export function PaymentPanel({
  booking,
  parentId,
  refresh,
}: {
  booking: BookingDetails;
  parentId: string;
  refresh: () => void;
}) {
  const storageKey = `ottodot-payment:${booking.id}`;
  const [outstanding, setOutstanding] = useState(() =>
    outstandingPayment(storageKey),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const terminal =
    booking.status === "confirmed" || booking.status === "refund_required";
  const last = booking.paymentAttempts.at(-1);

  async function pay(outcome: PaymentOutcome) {
    const request = outstanding ?? { key: crypto.randomUUID(), outcome };
    setBusy(true);
    setError("");
    setResultMessage("");
    try {
      // Save before sending so a lost response can be retried after a page reload.
      sessionStorage.setItem(storageKey, JSON.stringify(request));
      setOutstanding(request);
      const result = await api<PaymentResult>(
        `/api/bookings/${booking.id}/payments`,
        {
          method: "POST",
          headers: {
            ...parentHeaders(parentId),
            "Idempotency-Key": request.key,
          },
          body: JSON.stringify({ outcome: request.outcome }),
        },
      );
      sessionStorage.removeItem(storageKey);
      setOutstanding(null);
      setResultMessage(
        result.replayed
          ? "Original payment result recovered. No additional payment was recorded."
          : "Mock payment result recorded.",
      );
      refresh();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status < 500) {
        sessionStorage.removeItem(storageKey);
        setOutstanding(null);
        refresh();
      }
      setError(
        `${errorMessage(cause)}${!(cause instanceof ApiError) || cause.status >= 500 ? " The outcome is unknown. Retry the same request below." : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="payment-panel">
      <span className={`badge ${booking.status}`}>
        {statusLabels[booking.status]}
      </span>
      <h2>{booking.studentName}’s trial class</h2>
      <p className="chosen-class">{booking.classTitle}</p>
      {booking.status === "pending_payment" && (
        <p>
          The seat is still available to other parents until this booking is
          confirmed.
        </p>
      )}
      {booking.status === "payment_failed" && (
        <p>
          The last mock payment failed. Your child is not enrolled. You can try
          again; availability will be checked again.
        </p>
      )}
      {booking.status === "confirmed" && (
        <p className="success-copy">
          You’re booked! {booking.studentName} is on the teacher’s roster.
        </p>
      )}
      {booking.status === "refund_required" && (
        <p className="refund-copy">
          {refundMessage(last?.refundReason ?? null)}
        </p>
      )}
      {outstanding ? (
        <div className="pending-request">
          <p>
            A payment request may already have reached the server. Recover its
            result before starting another attempt.
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void pay(outstanding.outcome)}
          >
            {busy ? "Recovering result…" : "Retry same payment request"}
          </button>
        </div>
      ) : (
        !terminal && (
          <div className="payment-actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void pay("succeeded")}
            >
              {busy ? "Recording…" : "Simulate successful payment"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void pay("failed")}
            >
              Simulate failed payment
            </button>
          </div>
        )
      )}
      <small className="mock-note">
        Mock payment only. No card details or real charges.
      </small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {resultMessage && <p role="status">{resultMessage}</p>}
      <details className="payment-history">
        <summary>Payment history ({booking.paymentAttempts.length})</summary>
        {booking.paymentAttempts.length ? (
          <ol>
            {booking.paymentAttempts.map((attempt) => (
              <li key={attempt.id}>
                <strong>
                  {attempt.outcome === "succeeded"
                    ? "Payment succeeded"
                    : "Payment failed"}
                </strong>
                <span>Booking: {statusLabels[attempt.resultingStatus]}</span>
                <time dateTime={attempt.createdAt}>
                  {new Date(attempt.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p>No payment attempts recorded.</p>
        )}
      </details>
      <small className="booking-reference">
        Booking reference: {booking.id}
      </small>
    </div>
  );
}
