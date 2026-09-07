import {
  ArrowUpRight,
  BookOpen,
  Compass,
  GraduationCap,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Bootstrap } from "../shared/types";
import { api, errorMessage } from "./api";
import { navigate, useRoute } from "./navigation";
import { ParentBooking } from "./ParentBooking";
import { TeacherRoster } from "./TeacherRoster";

const pages = [
  { id: "classes", title: "Explore classes", icon: Compass },
  { id: "bookings", title: "My bookings", icon: BookOpen },
  { id: "roster", title: "Teacher roster", icon: Users },
] as const;

export function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [parentId, setParentId] = useState(
    () => sessionStorage.getItem("ottodot-parent") ?? "parent-amy",
  );
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const route = useRoute();
  const currentPage = pages.find((page) => page.id === route.view) ?? pages[0];
  const parent = data?.parents.find((p) => p.id === parentId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly invalidates the server snapshot.
  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    void api<Bootstrap>("/api/bootstrap", { signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setError("");
        setParentId((current) =>
          next.parents.some((p) => p.id === current)
            ? current
            : (next.parents[0]?.id ?? ""),
        );
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
    return () => controller.abort();
  }, [revision]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#/classes" aria-label="Ottodot home">
          <span className="brand-mark" aria-hidden="true">
            o
          </span>
          ottodot<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">
          <GraduationCap size={18} /> Family learning space
        </div>
        <nav aria-label="Main navigation">
          {pages.map(({ id, title, icon: Icon }) => (
            <a
              key={id}
              href={`#/${id}`}
              className={`nav-link ${route.view === id ? "active" : ""}`}
              aria-current={route.view === id ? "page" : undefined}
              onClick={(event) => {
                if (busy) event.preventDefault();
              }}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{title}</span>
              {route.view === id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Leaf size={22} />
          </span>
          <h3>
            Small groups.
            <br />
            Big possibilities.
          </h3>
          <p>
            Just four learners in every trial class. More room for every
            question.
          </p>
          <span className="note-seats" aria-hidden="true">
            {["A", "B", "C", "D"].map((letter) => (
              <span key={letter}>{letter}</span>
            ))}
          </span>
        </div>
        <div className="sidebar-footer">
          <ShieldCheck size={17} />
          <span>
            Trial booking demo<small>Synthetic families & payments</small>
          </span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>{currentPage.title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-indicator">
              <span /> Demo mode
            </span>
            <button
              type="button"
              className="refresh-button"
              disabled={busy || refreshing}
              onClick={() => setRevision((value) => value + 1)}
              aria-label="Refresh data"
            >
              <RefreshCw size={17} className={refreshing ? "spinning" : ""} />
              <span>Refresh</span>
            </button>
            <div className="account">
              <span className="avatar account-avatar" aria-hidden="true">
                {parent?.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("") ?? "AC"}
              </span>
              <div>
                <label htmlFor="parent">Demo parent</label>
                <select
                  id="parent"
                  value={parentId}
                  disabled={busy || Boolean(route.bookingId) || !data}
                  onChange={(event) => {
                    const id = event.target.value;
                    sessionStorage.setItem("ottodot-parent", id);
                    setParentId(id);
                    navigate(route.view);
                  }}
                >
                  {data?.parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>
        <main id="main-content">
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button
                type="button"
                className="text-button"
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading-state" role="status">
              <RefreshCw className="spinning" size={24} />
              <p>Getting your learning space ready…</p>
            </div>
          ) : route.view === "roster" ? (
            <TeacherRoster classes={data.classes} revision={revision} />
          ) : (
            <ParentBooking
              key={parentId}
              data={data}
              parentId={parentId}
              route={route}
              revision={revision}
              busy={busy}
              setBusy={setBusy}
              refresh={() => setRevision((value) => value + 1)}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>Made for curious minds.</span>
          <span>
            No real charges or authentication.
            <a
              href="https://github.com/hbinduni/ottodot-trial-booking"
              target="_blank"
              rel="noreferrer"
            >
              About this demo <ArrowUpRight size={13} />
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}
