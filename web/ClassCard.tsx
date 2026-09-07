import {
  ArrowRight,
  Atom,
  CalendarDays,
  Check,
  Clock3,
  Shapes,
  Video,
} from "lucide-react";
import type { Booking, TrialClass } from "../shared/types";
import fractionsArtwork from "./assets/fun-with-fractions.webp";
import spaceArtwork from "./assets/space-explorers.webp";
import { statusLabels } from "./status-message";

export function ClassSchedule({ startsAt }: { startsAt: string }) {
  const date = new Date(startsAt);
  return (
    <div className="class-schedule">
      <span>
        <CalendarDays size={16} />
        {date.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}
      </span>
      <span>
        <Clock3 size={16} />
        {date.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })}
      </span>
    </div>
  );
}

export function SeatCount({
  count,
  capacity = 4,
}: {
  count: number;
  capacity?: number;
}) {
  return (
    <span
      className="seat-count"
      role="img"
      aria-label={`${count} of ${capacity} seats filled`}
    >
      {Array.from({ length: capacity }, (_, index) => index + 1).map((seat) => (
        <span key={seat} className={seat <= count ? "filled" : ""} />
      ))}
    </span>
  );
}

export function ClassCard({
  trialClass,
  booking,
  busy,
  onChoose,
}: {
  trialClass: TrialClass;
  booking?: Booking;
  busy: boolean;
  onChoose: () => void;
}) {
  const science = trialClass.subject === "Science";
  const full = trialClass.availableSeats === 0;
  const started = Date.parse(trialClass.startsAt) <= Date.now();
  return (
    <article className={`class-card ${science ? "science" : "math"}`}>
      <div className="class-art">
        <img
          src={science ? spaceArtwork : fractionsArtwork}
          alt=""
          width="1536"
          height="1024"
        />
        <span className="subject-pill">
          {science ? <Atom size={15} /> : <Shapes size={15} />}
          {trialClass.subject}
        </span>
        <span className="online-pill">
          <Video size={14} />
          Live online
        </span>
      </div>
      <div className="class-card-body">
        <div className="class-card-title">
          <h3>{trialClass.title}</h3>
          {booking?.status === "confirmed" && (
            <span className="class-booked-icon" aria-hidden="true">
              <Check size={16} />
            </span>
          )}
        </div>
        <p className="class-description">
          {science
            ? "A curious first step into the world of science."
            : "Make room for a little mathematical discovery."}
        </p>
        <ClassSchedule startsAt={trialClass.startsAt} />
        <div className="class-card-bottom">
          <div className="availability">
            <SeatCount
              count={trialClass.confirmedCount}
              capacity={trialClass.capacity}
            />
            <span
              className={
                full || started
                  ? "muted"
                  : trialClass.availableSeats === 1
                    ? "last-seat"
                    : ""
              }
            >
              {started
                ? "Class started"
                : full
                  ? "Fully booked"
                  : trialClass.availableSeats === 1
                    ? "1 seat left"
                    : `${trialClass.availableSeats} seats available`}
            </span>
          </div>
          <button
            type="button"
            className={booking ? "button secondary" : "button primary"}
            disabled={busy || (!booking && (full || started))}
            onClick={onChoose}
          >
            {booking
              ? "View booking"
              : full || started
                ? "Unavailable"
                : "Book trial"}
            {!full && !started && !booking && <ArrowRight size={16} />}
          </button>
        </div>
        {booking && (
          <div className="existing-note">
            {booking.studentName}'s booking:{" "}
            <strong>{statusLabels[booking.status]}</strong>
          </div>
        )}
      </div>
    </article>
  );
}
