import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "violet"
  | "cyan"
  | "pink"
  | "success"
  | "warning"
  | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-border-strong bg-surface-raised text-muted",
  violet: "border-violet/40 bg-violet/15 text-violet-bright",
  cyan: "border-cyan/40 bg-cyan/15 text-cyan-bright",
  pink: "border-pink/40 bg-pink/15 text-pink",
  success: "border-success/40 bg-success/15 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning",
  danger: "border-danger/40 bg-danger/15 text-danger",
};

export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/* --- Status icons: status is never conveyed by colour alone --------------- */

function IconCheck() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 4.5 6 12 2.5 8.5" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.5V8l2.25 1.5" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.4 1.75H14.25V7.6a1 1 0 0 1-.3.7l-5.65 5.65a1 1 0 0 1-1.4 0L1.9 9.05a1 1 0 0 1 0-1.4L7.7 2.05a1 1 0 0 1 .7-.3Z" />
      <circle cx="11" cy="5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Evaluation / round status. Icon + word carry the meaning; colour reinforces it. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  /** Overrides the default wording (e.g. "Not started" instead of "Pending"). */
  label?: string;
  className?: string;
}) {
  const map: Record<string, { tone: Tone; icon: React.ReactNode; label: string }> =
    {
      submitted: { tone: "success", icon: <IconCheck />, label: "Submitted" },
      locked: { tone: "success", icon: <IconLock />, label: "Locked" },
      draft: { tone: "warning", icon: <IconClock />, label: "Draft" },
      pending: { tone: "neutral", icon: <IconClock />, label: "Pending" },
      active: { tone: "cyan", icon: <IconCheck />, label: "Active" },
    };
  const s = map[status] ?? {
    tone: "neutral" as Tone,
    icon: <IconClock />,
    label: status,
  };
  return (
    <Badge tone={s.tone} icon={s.icon} className={cn("capitalize", className)}>
      {label ?? s.label}
    </Badge>
  );
}

/** Track / category pill. */
export function TrackBadge({
  track,
  className,
}: {
  track?: string | null;
  className?: string;
}) {
  if (!track) return <span className="text-subtle">—</span>;
  return (
    <Badge tone="violet" icon={<IconTag />} className={className}>
      {track}
    </Badge>
  );
}

/** Live indicator — pulsing dot plus the word "Live" (not colour alone). */
export function LiveBadge({
  label = "Live",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Badge tone="pink" className={cn("pl-2", className)}>
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-pink"
      />
      {label}
    </Badge>
  );
}

/** Podium rank: gold / silver / bronze gradients for 1-3, neutral beyond. */
export function RankBadge({ rank }: { rank: number }) {
  const podium: Record<number, { bg: string; label: string }> = {
    1: { bg: "bg-gradient-gold", label: "1st place" },
    2: { bg: "bg-gradient-silver", label: "2nd place" },
    3: { bg: "bg-gradient-bronze", label: "3rd place" },
  };
  const medal = podium[rank];

  if (!medal) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border-strong font-display text-xs font-semibold text-muted tabular-nums">
        {rank}
      </span>
    );
  }

  return (
    <span
      title={medal.label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg font-display text-xs font-bold text-background tabular-nums shadow-glow-soft",
        medal.bg,
      )}
    >
      <span className="sr-only">{medal.label}: </span>
      {rank}
    </span>
  );
}
