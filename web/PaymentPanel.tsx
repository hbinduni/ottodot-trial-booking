import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  FlaskConical,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import type {
  BookingDetails,
  PaymentOutcome,
  PaymentResult,
  TrialClass,
} from "../shared/types";
import { ApiError, api, errorMessage, parentHeaders } from "./api";
import { ClassSchedule } from "./ClassCard";
import { navigate } from "./navigation";
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
    /* A malformed local draft is not proof of a payment result. */
  }
  sessionStorage.removeItem(storageKey);
  return null;
}

export function PaymentPanel({
  booking,
  trialClass,
  parentId,
  setBusy,
  onRecorded,
  refresh,
}: {
  booking: BookingDetails;
  trialClass?: TrialClass;
  parentId: string;
  setBusy: (busy: boolean) => void;
  onRecorded: (result: PaymentResult) => void;
  refresh: () => void;
}) {
  const storageKey = `ottodot-payment:${booking.id}`;
  const [outstanding, setOutstanding] = useState(() =>
    outstandingPayment(storageKey),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const terminal =
    booking.status === "confirmed" || booking.status === "refund_required";
  const last = booking.paymentAttempts.at(-1);

  async function pay(outcome: PaymentOutcome) {
    const request = outstanding ?? { key: crypto.randomUUID(), outcome };
    setBusy(true);
    setSubmitting(true);
    setError("");
    setResultMessage("");
    try {
      // Persist the exact command before sending so a lost response survives reloads.
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
      onRecorded(result);
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
      setSubmitting(false);
      setBusy(false);
    }
  }

  const StatusIcon =
    booking.status === "confirmed"
      ? CheckCircle2
      : booking.status === "pending_payment"
        ? Clock3
        : CircleAlert;
  return (
    <div className="payment-panel">
      <div className="booking-preview">
        <div className="booking-preview-top">
          <span className="avatar avatar-0">
            {booking.studentName.charAt(0)}
          </span>
          <span>
            <small>Trial class for</small>
            <strong>{booking.studentName}</strong>
          </span>
          <span className={`badge ${booking.status}`}>
            <span />
            {statusLabels[booking.status]}
          </span>
        </div>
        <h3>{booking.classTitle}</h3>
        {trialClass && <ClassSchedule startsAt={trialClass.startsAt} />}
      </div>
      <div className={`payment-state ${booking.status}`}>
        <span className="payment-state-icon">
          <StatusIcon size={25} />
        </span>
        <div>
          <h3>
            {booking.status === "confirmed"
              ? "You're booked!"
              : booking.status === "refund_required"
                ? "A refund is required"
                : booking.status === "payment_failed"
                  ? "Let's give that another try"
                  : "Ready when you are"}
          </h3>
          {booking.status === "pending_payment" && (
            <p>
              A seat isn't reserved yet. Complete a mock payment to check
              availability and confirm the booking.
            </p>
          )}
          {booking.status === "payment_failed" && (
            <p>
              The last mock payment failed. {booking.studentName} is not
              enrolled. You can retry, and we'll check for a seat again.
            </p>
          )}
          {booking.status === "confirmed" && (
            <p>
              {booking.studentName} is on the teacher's roster. Your place in{" "}
              {booking.classTitle} is confirmed.
            </p>
          )}
          {booking.status === "refund_required" && (
            <p>{refundMessage(last?.refundReason ?? null)}</p>
          )}
        </div>
      </div>
      {outstanding ? (
        <div className="pending-request">
          <RotateCcw size={20} />
          <h3>Recover your payment result</h3>
          <p>
            The previous request may have reached the server. Retry it with the
            same key before starting another attempt.
          </p>
          <button
            type="button"
            className="button primary full-width"
            disabled={submitting}
            onClick={() => void pay(outstanding.outcome)}
          >
            {submitting ? "Recovering result…" : "Retry same payment request"}
          </button>
        </div>
      ) : !terminal ? (
        <section className="payment-simulator" aria-label="Mock payment">
          <div className="simulator-heading">
            <CreditCard size={19} />
            <h3>Complete your booking</h3>
            <span className="simulator-badge">
              <FlaskConical size={12} />
              Simulator
            </span>
          </div>
          <p>
            This is a mock payment. Choose a result to see how the booking
            responds.
          </p>
          <div className="payment-actions">
            <button
              type="button"
              className="button primary full-width"
              disabled={submitting}
              onClick={() => void pay("succeeded")}
            >
              {submitting
                ? "Recording payment…"
                : "Simulate successful payment"}
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="button secondary full-width"
              disabled={submitting}
              onClick={() => void pay("failed")}
            >
              Simulate failed payment
            </button>
          </div>
          <small className="mock-note">
            <ShieldCheck size={14} />
            No card details. No real charges.
          </small>
        </section>
      ) : (
        <button
          type="button"
          className="button secondary full-width"
          onClick={() => navigate("bookings")}
        >
          View my bookings <ArrowRight size={16} />
        </button>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {resultMessage && (
        <p className="result-message" role="status">
          <CheckCircle2 size={15} />
          {resultMessage}
        </p>
      )}
      <details className="payment-history">
        <summary>Payment history ({booking.paymentAttempts.length})</summary>
        {booking.paymentAttempts.length ? (
          <ol>
            {booking.paymentAttempts.map((attempt) => (
              <li key={attempt.id}>
                <span className={`history-dot ${attempt.outcome}`} />
                <div>
                  <strong>
                    {attempt.outcome === "succeeded"
                      ? "Payment succeeded"
                      : "Payment failed"}
                  </strong>
                  <span className="history-booking-state">
                    Booking: {statusLabels[attempt.resultingStatus]}
                  </span>
                  <time dateTime={attempt.createdAt}>
                    {new Date(attempt.createdAt).toLocaleString()}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>No payment attempts recorded.</p>
        )}
      </details>
      <div className="booking-reference">
        <span className="reference-label">Booking reference</span>
        <code>{booking.id}</code>
      </div>
    </div>
  );
}
