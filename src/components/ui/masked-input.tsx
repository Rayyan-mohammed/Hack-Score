"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.8 10S4.9 4.8 10 4.8 18.2 10 18.2 10 15.1 15.2 10 15.2 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.4" />
      {!open && <path d="m3.5 3.5 13 13" />}
    </svg>
  );
}

/**
 * A marks field that stays hidden until the judge asks to see it.
 *
 * Entered marks render as a password-style row of dots so a score can't be
 * read over a shoulder (or off a shared screen) while the rest of the rubric
 * is being filled in. The View button toggles the value in and out of sight.
 *
 * While hidden the input is `type="password"`, which drops the browser's
 * numeric stepper and range checks, so keystrokes are filtered here and the
 * range is enforced on submit by the server action.
 */
export function MaskedMarksInput({
  id,
  name,
  max,
  defaultValue = "",
  disabled = false,
  reveal = false,
  className,
}: {
  id: string;
  name: string;
  max: number;
  defaultValue?: string | number;
  disabled?: boolean;
  /** Drives the field from a "show all marks" toggle above the list. */
  reveal?: boolean;
  className?: string;
}) {
  const [value, setValue] = React.useState(String(defaultValue ?? ""));
  const [shown, setShown] = React.useState(reveal);

  // Follow the group toggle, while leaving per-field control intact after it.
  // Adjusting during render (rather than in an effect) is React's own pattern
  // for state that has to track a prop change — no extra pass, no flash.
  const [lastReveal, setLastReveal] = React.useState(reveal);
  if (reveal !== lastReveal) {
    setLastReveal(reveal);
    setShown(reveal);
  }

  const onChange = (next: string) => {
    // Digits and at most one decimal point — the numeric input type isn't
    // there to reject anything else while the field is masked.
    if (next === "" || /^\d*\.?\d*$/.test(next)) setValue(next);
  };

  const over = value !== "" && Number(value) > max;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Input
        id={id}
        name={name}
        type={shown ? "number" : "password"}
        inputMode="decimal"
        autoComplete="off"
        min={0}
        max={max}
        step="0.5"
        placeholder={shown ? "0" : "••••••"}
        value={value}
        disabled={disabled}
        aria-invalid={over || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-24 text-right font-display text-base font-semibold tabular-nums",
          !shown && "tracking-[0.25em]",
          over && "border-danger",
        )}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        disabled={disabled}
        aria-pressed={shown}
        aria-controls={id}
        aria-label={shown ? "Hide marks" : "View marks"}
        title={shown ? "Hide marks" : "View marks"}
        className="flex h-11 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
      >
        <EyeIcon open={shown} />
      </button>
    </div>
  );
}
