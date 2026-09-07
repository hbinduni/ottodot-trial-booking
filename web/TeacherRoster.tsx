import { CheckCircle2, GraduationCap, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { Roster, TrialClass } from "../shared/types";
import { api, errorMessage } from "./api";
import { ClassSchedule, SeatCount } from "./ClassCard";

export function TeacherRoster({
  classes,
  revision,
}: {
  classes: TrialClass[];
  revision: number;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: manual refresh and retry reload this class's roster snapshot.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void api<Roster>(`/api/classes/${encodeURIComponent(classId)}/roster`, {
      signal: controller.signal,
    })
      .then((next) => {
        if (!controller.signal.aborted) setRoster(next);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [classId, revision, retry]);
  const current = roster?.trialClass.id === classId ? roster : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ready for the next discovery.</h1>
          <p>Your class roster, with every confirmed learner in one place.</p>
        </div>
        <span className="teacher-pill">
          <GraduationCap size={17} /> Teacher preview
        </span>
      </div>
      <div className="teacher-notice">
        <Users size={19} />
        <p>
          Only confirmed bookings appear here. Pending payments and
          refund-required bookings are excluded.
        </p>
      </div>
      <fieldset
        className="roster-class-options"
        aria-label="Choose roster class"
      >
        {classes.map((c) => (
          <button
            type="button"
            key={c.id}
            className={c.id === classId ? "active" : ""}
            aria-pressed={c.id === classId}
            onClick={() => setClassId(c.id)}
          >
            <span>{c.subject}</span>
            <strong>{c.title}</strong>
            <small>Up to {c.capacity} learners</small>
          </button>
        ))}
      </fieldset>
      {error ? (
        <div className="alert error" role="alert">
          {error}
          <button
            type="button"
            className="text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : loading || !current ? (
        <p className="loading-state" role="status">
          Loading confirmed learners…
        </p>
      ) : (
        <section className="roster-panel" aria-labelledby="roster-heading">
          <div className="roster-header">
            <div>
              <h2 id="roster-heading">{current.trialClass.title}</h2>
              <ClassSchedule startsAt={current.trialClass.startsAt} />
            </div>
            <div className="roster-occupancy">
              <SeatCount
                count={current.students.length}
                capacity={current.trialClass.capacity}
              />
              <strong>
                {current.students.length} / {current.trialClass.capacity}{" "}
                confirmed
              </strong>
            </div>
          </div>
          <table className="roster-table">
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Booking reference</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {current.students.map((student, index) => (
                <tr key={student.id}>
                  <td>
                    <span className="roster-name">
                      <span className={`avatar avatar-${index % 3}`}>
                        {student.name.charAt(0)}
                      </span>
                      <strong>{student.name}</strong>
                    </span>
                  </td>
                  <td className="reference-cell">{student.bookingId}</td>
                  <td>
                    <span className="badge confirmed">
                      <CheckCircle2 size={13} />
                      Confirmed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {current.students.length === 0 && (
            <div className="empty-state">
              <Users size={28} />
              <h3>No confirmed learners yet</h3>
              <p>
                Children will appear here when their trial booking is confirmed.
              </p>
            </div>
          )}
          <div className="roster-footnote">
            <CheckCircle2 size={15} /> Refresh to see newly confirmed learners.
          </div>
        </section>
      )}
      <p className="teacher-disclaimer">
        Teacher preview is open in this demo. Production access would require an
        authenticated teacher role.
      </p>
    </>
  );
}
