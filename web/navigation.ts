import { useEffect, useState } from "react";

export type View = "classes" | "bookings" | "roster";
export interface Route {
  view: View;
  bookingId: string | null;
}

function currentRoute(): Route {
  const [path, search = ""] = window.location.hash.slice(1).split("?");
  const view: View =
    path === "/bookings"
      ? "bookings"
      : path === "/roster"
        ? "roster"
        : "classes";
  return {
    view,
    bookingId:
      view === "roster" ? null : new URLSearchParams(search).get("booking"),
  };
}

export function navigate(view: View, bookingId?: string) {
  window.location.hash = `/${view}${bookingId ? `?booking=${encodeURIComponent(bookingId)}` : ""}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}
