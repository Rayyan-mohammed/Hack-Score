"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCountdown } from "@/lib/registration-form";

export type StaleDraft = {
  roundId: string;
  roundName: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  /** When the judge last saved it. */
  savedAt: string;
};

function hoursSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000));
}

/**
 * Two warnings a judge needs before scoring closes:
 *
 * 1. How long is left. At the deadline every saved draft is submitted as it
 *    stands, so the countdown is the difference between a score that counts
 *    and one that does not.
 * 2. Which drafts they started and left. A draft counts for nothing until it
 *    is submitted, and it is easy to save one, walk to the next table and
 *    forget it — so each is named with its round and team, and links straight
 *    back to the scorecard.
 */
export function DeadlineBanner({
  deadline,
  deadlineLabel,
  staleDrafts,
  reminderHours,
}: {
  deadline: string | null;
  deadlineLabel: string;
  staleDrafts: StaleDraft[];
  reminderHours: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const remaining = deadline ? new Date(deadline).getTime() - now : null;
  const closed = remaining !== null && remaining <= 0;
  // Under an hour the countdown turns amber, the same signal the registration
  // form uses for its own closing window.
  const urgent = remaining !== null && remaining > 0 && remaining < 3600_000;

  if (!deadline && staleDrafts.length === 0) return null;

  return (
    <div className="space-y-3">
      {deadline && (
        <div
          role="status"
          aria-live="polite"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            closed
              ? "border-border-strong bg-surface-raised"
              : urgent
                ? "border-warning/50 bg-warning/10"
                : "border-violet/40 bg-violet/10"
          }`}
        >
          <p className="text-sm font-medium text-foreground">
            {closed ? (
              <>Scoring closed. Any draft still open was submitted as it stood.</>
            ) : (
              <>
                Scoring closes in{" "}
                <span
                  className={`font-mono text-base font-semibold tabular-nums ${
                    urgent ? "text-warning" : "text-violet-bright"
                  }`}
                >
                  {formatCountdown(remaining ?? 0)}
                </span>
              </>
            )}
          </p>
          <p className="text-xs text-muted">
            {closed
              ? `Closed ${deadlineLabel}`
              : `Drafts left unsubmitted at ${deadlineLabel} are submitted automatically.`}
          </p>
        </div>
      )}

      {staleDrafts.length > 0 && !closed && (
        <div
          role="alert"
          className="rounded-xl border border-warning/50 bg-warning/10 px-4 py-3"
        >
          <p className="text-sm font-medium text-warning">
            You haven&apos;t submitted {staleDrafts.length} saved{" "}
            {staleDrafts.length === 1 ? "scorecard" : "scorecards"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Saved over {reminderHours} hours ago and still a draft. A draft
            counts for nothing until you press Submit.
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {staleDrafts.map((d) => (
              <li key={`${d.roundId}:${d.teamId}`}>
                <Link
                  href={`/judge/rounds/${d.roundId}/teams/${d.teamId}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-surface-raised"
                >
                  <span className="font-mono text-xs text-muted">
                    {d.teamCode}
                  </span>
                  <span className="font-medium text-foreground">
                    {d.teamName}
                  </span>
                  <span className="text-xs text-subtle">· {d.roundName}</span>
                  <span className="text-xs text-subtle">
                    · saved {hoursSince(d.savedAt)}h ago
                  </span>
                  <span className="ml-auto text-xs font-medium text-violet-bright">
                    Finish it →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
