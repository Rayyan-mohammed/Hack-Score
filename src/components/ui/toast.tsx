import * as React from "react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

const tones: Record<
  ToastTone,
  { ring: string; text: string; icon: React.ReactNode; label: string }
> = {
  success: {
    ring: "border-success/40",
    text: "text-success",
    label: "Success",
    icon: (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" strokeWidth="1.5" />
        <path d="M5 8.25 7 10.25l4-4.5" />
      </svg>
    ),
  },
  error: {
    ring: "border-danger/40",
    text: "text-danger",
    label: "Error",
    icon: (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" strokeWidth="1.5" />
        <path d="M8 4.75v4M8 11.1h.01" />
      </svg>
    ),
  },
  info: {
    ring: "border-cyan/40",
    text: "text-cyan-bright",
    label: "Note",
    icon: (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" strokeWidth="1.5" />
        <path d="M8 7.5v3.75M8 4.9h.01" />
      </svg>
    ),
  },
};

/**
 * Inline notification / toast. Icon + visually-hidden label carry the meaning
 * so status never rests on colour alone. Renders nothing when `message` is empty,
 * which suits `useActionState` results directly.
 */
export function Toast({
  tone = "info",
  message,
  className,
}: {
  tone?: ToastTone;
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  const t = tones[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "glass flex animate-fade-in-up items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        t.ring,
        className,
      )}
    >
      <span className={cn("mt-px", t.text)}>{t.icon}</span>
      <p className="text-foreground">
        <span className="sr-only">{t.label}: </span>
        {message}
      </p>
    </div>
  );
}
