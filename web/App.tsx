import { useEffect, useState } from "react";
import type { Bootstrap, Roster } from "../shared/types";
import { api, errorMessage } from "./api";
import { ParentBooking } from "./ParentBooking";

export function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [parentId, setParentId] = useState("parent-amy");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision deliberately invalidates the server snapshot after a mutation or manual refresh.
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const next = await api<Bootstrap>("/api/bootstrap", {
          signal: controller.signal,
        });
        const rows = await Promise.all(
          next.classes.map((c) =>
            api<Roster>(`/api/classes/${c.id}/roster`, {
              signal: controller.signal,
            }),
          ),
        );
        if (controller.signal.aborted) return;
        setData(next);
        setRosters(rows);
        setError("");
      } catch (cause) {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  return (
    <>
      <header className="header">
        <a className="brand" href="/" aria-label="Ottodot home">
          <span className="brand-mark" aria-hidden="true">
            o
          </span>
          ottodot<span className="brand-dot">.</span>
        </a>
        <span className="demo-label">Take-home demo</span>
      </header>
      <main>
        <div className="intro">
          <div>
            <h1>
              A little curiosity.
              <br />A new favourite class.
            </h1>
            <p>
              Try a live science or math class, with just four children in each
              group.
            </p>
          </div>
          <div className="demo-controls">
            <label htmlFor="parent">Demo parent</label>
            <select
              id="parent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              {data?.parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <small>
              Switch families to explore the demo. All people and payments are
              fictional.
            </small>
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}{" "}
            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
            >
              Try again
            </button>
          </p>
        )}
        {!data ? (
          <p role="status">Loading trial classes…</p>
        ) : (
          <ParentBooking
            key={parentId}
            data={data}
            parentId={parentId}
            revision={revision}
            refresh={() => setRevision((value) => value + 1)}
          />
        )}
        <section className="roster-section" aria-labelledby="roster-heading">
          <div className="section-heading">
            <div>
              <h2 id="roster-heading">Teacher roster</h2>
              <p>
                Confirmed children only. Pending and failed bookings do not
                appear here.
              </p>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              Refresh data
            </button>
          </div>
          <div className="roster-grid">
            {rosters.map((roster) => (
              <article className="roster" key={roster.trialClass.id}>
                <h3>
                  {roster.trialClass.title}
                  <span className="roster-count">
                    {roster.students.length} / 4
                  </span>
                </h3>
                {roster.students.length ? (
                  <ul>
                    {roster.students.map((student) => (
                      <li key={student.id}>
                        <span className="avatar" aria-hidden="true">
                          {student.name.charAt(0)}
                        </span>
                        {student.name}
                        <span className="roster-confirmed">Confirmed</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No confirmed children yet.</p>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer>
        Synthetic data · Mock payments · No real authentication
        <br />
        Built for the Ottodot trial booking take-home.
      </footer>
    </>
  );
}
