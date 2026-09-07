import { useEffect, useState } from "react";
import type { Booking, BookingDetails, Bootstrap } from "../shared/types";
import { api, errorMessage, parentHeaders } from "./api";
import { PaymentPanel } from "./PaymentPanel";
import { statusLabels } from "./status-message";

export function ParentBooking({
  data,
  parentId,
  revision,
  refresh,
}: {
  data: Bootstrap;
  parentId: string;
  revision: number;
  refresh: () => void;
}) {
  const children = data.students.filter(
    (student) => student.parentId === parentId,
  );
  const [studentId, setStudentId] = useState(children[0]?.id ?? "");
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeId, setActiveId] = useState("");
  const [detail, setDetail] = useState<BookingDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision deliberately reloads bookings changed by a payment or another browser tab.
  useEffect(() => {
    const controller = new AbortController();
    void api<Booking[]>("/api/bookings", {
      headers: parentHeaders(parentId),
      signal: controller.signal,
    })
      .then(setBookings)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [parentId, revision]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the active booking must reload when its server state changes.
  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    void api<BookingDetails>(`/api/bookings/${activeId}`, {
      headers: parentHeaders(parentId),
      signal: controller.signal,
    })
      .then(setDetail)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [activeId, parentId, revision]);

  const selected = data.classes.find((c) => c.id === classId);
  const existing = bookings.find(
    (b) => b.studentId === studentId && b.classId === classId,
  );
  const unavailable =
    !selected ||
    selected.availableSeats === 0 ||
    Date.parse(selected.startsAt) <= Date.now();

  async function book() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ booking: Booking; created: boolean }>(
        "/api/bookings",
        {
          method: "POST",
          headers: parentHeaders(parentId),
          body: JSON.stringify({ studentId, classId }),
        },
      );
      setActiveId(result.booking.id);
      setNotice(
        result.created
          ? "Booking started. Your seat is confirmed only after payment completes and a seat is available."
          : "You already have a booking for this child and class. Here is its current status.",
      );
      refresh();
    } catch (cause) {
      setError(errorMessage(cause));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="booking-layout">
        <section className="class-section" aria-labelledby="classes-heading">
          <h2 id="classes-heading">Find their next discovery</h2>
          <label htmlFor="child">Choose your child</label>
          <select
            id="child"
            className="child-select"
            value={studentId}
            disabled={busy}
            onChange={(event) => setStudentId(event.target.value)}
          >
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
          <fieldset className="class-list" disabled={busy}>
            <legend>Choose a trial class</legend>
            {data.classes.map((trialClass) => (
              <label
                key={trialClass.id}
                className={`class-option ${classId === trialClass.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="trial-class"
                  value={trialClass.id}
                  checked={classId === trialClass.id}
                  onChange={() => setClassId(trialClass.id)}
                />
                <span className="class-content">
                  <span className="subject">{trialClass.subject}</span>
                  <strong>{trialClass.title}</strong>
                  <span className="class-date">
                    {new Date(trialClass.startsAt).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </span>
                  <span className="availability">
                    <span className="seats" aria-hidden="true">
                      {[0, 1, 2, 3].map((seat) => (
                        <span
                          key={seat}
                          className={
                            seat < trialClass.confirmedCount ? "occupied" : ""
                          }
                        />
                      ))}
                    </span>
                    {trialClass.availableSeats} of 4 seats available
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="hint">Selecting a class does not reserve a seat.</p>
          <button
            type="button"
            className="primary"
            disabled={busy || !studentId || (!existing && unavailable)}
            onClick={() => void book()}
          >
            {busy
              ? "Starting booking…"
              : existing
                ? "Open existing booking"
                : unavailable
                  ? "Class unavailable"
                  : "Continue to mock payment"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
        </section>
        <aside className="payment-aside" aria-label="Your booking">
          {detail ? (
            <PaymentPanel
              key={detail.id}
              booking={detail}
              parentId={parentId}
              refresh={refresh}
            />
          ) : activeId ? (
            <p role="status">Loading booking…</p>
          ) : (
            <div className="empty-booking">
              <div className="seat-illustration" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
              <h2>
                A small class.
                <br />
                Room for big questions.
              </h2>
              <p>
                Choose a child and a class to start. You can simulate a
                successful or failed payment in the next step.
              </p>
            </div>
          )}
        </aside>
      </div>
      <section className="your-bookings" aria-labelledby="bookings-heading">
        <h2 id="bookings-heading">Your bookings</h2>
        {bookings.length ? (
          <div className="booking-list">
            {bookings.map((booking) => (
              <button
                type="button"
                key={booking.id}
                className={`booking-row ${activeId === booking.id ? "active" : ""}`}
                onClick={() => {
                  setActiveId(booking.id);
                  setNotice("");
                  setError("");
                }}
              >
                <span>
                  <strong>{booking.studentName}</strong>
                  <span>{booking.classTitle}</span>
                </span>
                <span className={`badge ${booking.status}`}>
                  {statusLabels[booking.status]}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p>No bookings yet. Choose a trial class above to get started.</p>
        )}
      </section>
    </>
  );
}
