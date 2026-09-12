"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the current page's server content on a timer.
 *
 * Judge pages are rendered per request, so their data is never stale on the
 * server — but a judge who leaves the page open all evening keeps whatever was
 * rendered when they opened it. An organiser fixing a team's problem statement
 * mid-event would not reach them until they happened to reload.
 *
 * `router.refresh()` re-runs the server components and swaps in the new
 * markup; React state inside client components (a half-filled scorecard) is
 * preserved, so this never interrupts someone mid-score. Refreshes are skipped
 * while the tab is hidden, and one runs immediately when the tab regains
 * focus, which is when someone is most likely to be looking at stale content.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const timer = setInterval(refreshIfVisible, seconds * 1000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, seconds]);

  return null;
}
