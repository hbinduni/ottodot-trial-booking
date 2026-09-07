import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  Booking,
  BookingDetails,
  Bootstrap,
  PaymentResult,
} from "../shared/types";
import { api, errorMessage, parentHeaders } from "./api";
import { BookingDialog } from "./BookingDialog";
import { ClassCard, ClassSchedule } from "./ClassCard";
import { navigate, type Route } from "./navigation";
import { PaymentPanel } from "./PaymentPanel";
import { statusLabels } from "./status-message";

export function ParentBooking({
  data,
  parentId,
  route,
  revision,
  busy,
  setBusy,
  refresh,
}: {
  data: Bootstrap;
  parentId: string;
  route: Route;
  revision: number;
  busy: boolean;
  setBusy: (value: boolean) => void;
  refresh: () => void;
}) {
  const children = data.students.filter(
    (student) => student.parentId === parentId,
  );
  const [studentId, setStudentId] = useState(children[0]?.id ?? "");
  const [subject, setSubject] = useState("All subjects");
  const [bookingFilter, setBookingFilter] = useState("All bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BookingDetails | null>(null);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const activeId = route.bookingId;

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision reloads bookings after payment and manual refresh.
  useEffect(() => {
    const controller = new AbortController();
    void api<Booking[]>("/api/bookings", {
      headers: parentHeaders(parentId),
      signal: controller.signal,
    })
      .then((next) => {
        if (!controller.signal.aborted) {
          setBookings(next);
          setListError("");
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setListError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [parentId, revision]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: preserve the open panel while refreshing its current server state.
  useEffect(() => {
    setDetailError("");
    if (!activeId) return;
    const controller = new AbortController();
    void api<BookingDetails>(`/api/bookings/${encodeURIComponent(activeId)}`, {
      headers: parentHeaders(parentId),
      signal: controller.signal,
    })
      .then((next) => {
        if (!controller.signal.aborted) setDetail(next);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setDetailError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [activeId, parentId, revision]);

  async function book(classId: string) {
    const existing = bookings.find(
      (b) => b.studentId === studentId && b.classId === classId,
    );
    setActionError("");
    setNotice("");
    if (existing) {
      navigate(route.view, existing.id);
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ booking: Booking; created: boolean }>(
        "/api/bookings",
        {
          method: "POST",
          headers: parentHeaders(parentId),
          body: JSON.stringify({ studentId, classId }),
        },
      );
      setNotice(
        result.created
          ? "Your booking has started. A seat is confirmed only after a successful payment and an availability check."
          : "You already have a booking for this child and class. Here is the existing booking.",
      );
      navigate(route.view, result.booking.id);
      refresh();
    } catch (cause) {
      setActionError(errorMessage(cause));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  function paymentRecorded(result: PaymentResult) {
    setDetail((current) =>
      current?.id === result.booking.id
        ? {
            ...result.booking,
            paymentAttempts: current.paymentAttempts.some(
              (attempt) => attempt.id === result.attempt.id,
            )
              ? current.paymentAttempts
              : [...current.paymentAttempts, result.attempt],
          }
        : current,
    );
    refresh();
  }

  const visibleClasses = data.classes.filter(
    (c) => subject === "All subjects" || c.subject === subject,
  );
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const attention = bookings.filter((b) => b.status !== "confirmed");
  const filteredBookings =
    bookingFilter === "Confirmed"
      ? confirmed
      : bookingFilter === "Needs attention"
        ? attention
        : bookings;

  return (
    <>
      {route.view === "classes" ? (
        <>
          <div className="page-heading">
            <div>
              <h1>Find their next favourite class.</h1>
              <p>
                A little science, a little math, and a whole lot of curiosity.
              </p>
            </div>
            <span className="page-emblem">
              <Sparkles size={24} />
            </span>
          </div>
          <section className="welcome-banner">
            <div>
              <span className="banner-tag">
                <Sparkles size={14} /> A great place to start
              </span>
              <h2>
                Big questions.
                <br />
                Small classes.
              </h2>
              <p>
                Try a live class with just four learners.
                <br className="desktop-break" /> Give their curiosity a little
                room to grow.
              </p>
            </div>
            <div className="banner-feature">
              <div className="four-learners" aria-hidden="true">
                <span>A</span>
                <span>B</span>
                <span>C</span>
                <span>D</span>
              </div>
              <strong>Every learner counts.</strong>
              <span>4 children maximum per trial</span>
            </div>
          </section>
          <section className="child-section" aria-labelledby="child-heading">
            <div>
              <h2 id="child-heading">Who’s joining?</h2>
              <p>Choose a child to see their bookings.</p>
            </div>
            <div className="child-options">
              {children.map((child, index) => (
                <button
                  type="button"
                  key={child.id}
                  className={`child-option ${studentId === child.id ? "selected" : ""}`}
                  aria-pressed={studentId === child.id}
                  aria-label={`Select ${child.name}`}
                  disabled={busy}
                  onClick={() => {
                    setStudentId(child.id);
                    setActionError("");
                  }}
                >
                  <span className={`avatar child-avatar avatar-${index % 3}`}>
                    {child.name.charAt(0)}
                  </span>
                  <span>
                    {child.name}
                    <small>
                      {studentId === child.id
                        ? "Selected learner"
                        : "Choose learner"}
                    </small>
                  </span>
                  {studentId === child.id && (
                    <span className="child-check">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
          <section aria-labelledby="classes-heading">
            <div className="section-heading">
              <div>
                <h2 id="classes-heading">
                  Explore trial classes{" "}
                  <span className="count-label">{visibleClasses.length}</span>
                </h2>
                <p>A new interest could be one class away.</p>
              </div>
              <fieldset
                className="filter-tabs"
                aria-label="Filter classes by subject"
              >
                {[
                  "All subjects",
                  ...new Set(data.classes.map((c) => c.subject)),
                ].map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={subject === item ? "active" : ""}
                    aria-pressed={subject === item}
                    onClick={() => setSubject(item)}
                  >
                    {item}
                  </button>
                ))}
              </fieldset>
            </div>
            <div className="class-grid">
              {visibleClasses.map((trialClass) => (
                <ClassCard
                  key={trialClass.id}
                  trialClass={trialClass}
                  booking={bookings.find(
                    (b) =>
                      b.studentId === studentId && b.classId === trialClass.id,
                  )}
                  busy={busy || loading || Boolean(listError) || !studentId}
                  onChoose={() => void book(trialClass.id)}
                />
              ))}
            </div>
            {!visibleClasses.length && (
              <div className="empty-state">
                <Search size={25} />
                <h3>No classes in this subject yet</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setSubject("All subjects")}
                >
                  See all classes
                </button>
              </div>
            )}
            <p className="booking-assurance">
              <ShieldCheck size={17} />
              Selecting a class does not hold a seat. We confirm availability
              when payment completes.
            </p>
          </section>
          {bookings.length > 0 && (
            <div className="bookings-shortcut">
              <div className="shortcut-icon">
                <BookOpen size={21} />
              </div>
              <div>
                <strong>Your learning plans, all in one place</strong>
                <p>
                  {confirmed.length} confirmed{" "}
                  {confirmed.length === 1 ? "booking" : "bookings"}
                  {attention.length > 0
                    ? ` · ${attention.length} ${attention.length === 1 ? "needs" : "need"} attention`
                    : ""}
                </p>
              </div>
              <a href="#/bookings">
                My bookings <ArrowRight size={17} />
              </a>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <h1>My bookings</h1>
              <p>
                Keep track of every trial, from first click to confirmed seat.
              </p>
            </div>
            <a className="button primary" href="#/classes">
              Explore classes <ArrowRight size={16} />
            </a>
          </div>
          <div className="booking-summary">
            <div>
              <span className="summary-icon blue">
                <BookOpen size={21} />
              </span>
              <span>
                <strong>{loading ? "—" : bookings.length}</strong>Total bookings
              </span>
            </div>
            <div>
              <span className="summary-icon green">
                <CheckCircle2 size={21} />
              </span>
              <span>
                <strong>{loading ? "—" : confirmed.length}</strong>Confirmed
              </span>
            </div>
            <div>
              <span className="summary-icon amber">
                <Clock3 size={21} />
              </span>
              <span>
                <strong>{loading ? "—" : attention.length}</strong>Need
                attention
              </span>
            </div>
          </div>
          <section
            className="bookings-section"
            aria-labelledby="bookings-heading"
          >
            <div className="section-heading">
              <h2 id="bookings-heading">Your trial bookings</h2>
              <fieldset className="filter-tabs" aria-label="Filter bookings">
                {["All bookings", "Confirmed", "Needs attention"].map(
                  (filter) => (
                    <button
                      type="button"
                      key={filter}
                      className={filter === bookingFilter ? "active" : ""}
                      aria-pressed={filter === bookingFilter}
                      onClick={() => setBookingFilter(filter)}
                    >
                      {filter}
                    </button>
                  ),
                )}
              </fieldset>
            </div>
            {loading ? (
              <p className="loading-state" role="status">
                Loading your bookings…
              </p>
            ) : !listError && filteredBookings.length === 0 ? (
              <div className="empty-state">
                <BookOpen size={30} />
                <h3>
                  {bookings.length
                    ? "No bookings in this view"
                    : "A first discovery is waiting"}
                </h3>
                <p>
                  {bookings.length
                    ? "Try another filter to find your trial."
                    : "Choose a class and start a trial booking for your child."}
                </p>
                <a className="button secondary" href="#/classes">
                  Explore classes
                </a>
              </div>
            ) : (
              <div className="booking-table">
                <div className="booking-table-head" aria-hidden="true">
                  <span>Class & learner</span>
                  <span>Schedule</span>
                  <span>Status</span>
                  <span />
                </div>
                {filteredBookings.map((booking) => {
                  const trialClass = data.classes.find(
                    (c) => c.id === booking.classId,
                  );
                  return (
                    <button
                      type="button"
                      className="booking-row"
                      key={booking.id}
                      disabled={busy}
                      onClick={() => {
                        setNotice("");
                        navigate("bookings", booking.id);
                      }}
                    >
                      <span className="booking-identity">
                        <span
                          className={`avatar ${trialClass?.subject === "Science" ? "avatar-0" : "avatar-1"}`}
                        >
                          {booking.studentName.charAt(0)}
                        </span>
                        <span>
                          <strong>{booking.classTitle}</strong>
                          <small>{booking.studentName}</small>
                        </span>
                      </span>
                      <span>
                        {trialClass && (
                          <ClassSchedule startsAt={trialClass.startsAt} />
                        )}
                      </span>
                      <span className={`badge ${booking.status}`}>
                        <span />
                        {statusLabels[booking.status]}
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
      {listError && (
        <div className="alert error" role="alert">
          Could not load your bookings. {listError}
          <button type="button" className="text-button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}
      {actionError && (
        <div className="alert error" role="alert">
          {actionError}
        </div>
      )}
      {activeId && (
        <BookingDialog
          busy={busy}
          onClose={() => {
            setNotice("");
            navigate(route.view);
          }}
        >
          {detailError ? (
            <div className="alert error" role="alert">
              {detailError}
              <button type="button" className="text-button" onClick={refresh}>
                Try again
              </button>
            </div>
          ) : detail?.id === activeId ? (
            <>
              {notice && (
                <p className="dialog-notice" role="status">
                  {notice}
                </p>
              )}
              <PaymentPanel
                key={detail.id}
                booking={detail}
                trialClass={data.classes.find((c) => c.id === detail.classId)}
                parentId={parentId}
                setBusy={setBusy}
                onRecorded={paymentRecorded}
                refresh={refresh}
              />
            </>
          ) : (
            <p className="loading-state" role="status">
              Loading booking…
            </p>
          )}
        </BookingDialog>
      )}
    </>
  );
}
