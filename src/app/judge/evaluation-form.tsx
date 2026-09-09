"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { MaskedMarksInput } from "@/components/ui/masked-input";
import { StatusBadge } from "@/components/ui/badge";
import { Toast } from "@/components/ui/toast";
import { saveEvaluation, type EvalState } from "./actions";

type Criterion = { id: string; name: string; max_marks: number; weight: number };

function LockWarning() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
      <svg
        viewBox="0 0 20 20"
        className="mt-px h-5 w-5 shrink-0 text-warning"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 7.5v3.5M10 14h.01M8.6 3.2 1.7 15a1.6 1.6 0 0 0 1.4 2.4h13.8a1.6 1.6 0 0 0 1.4-2.4L11.4 3.2a1.6 1.6 0 0 0-2.8 0Z" />
      </svg>
      <p className="text-sm text-warning">
        <span className="font-semibold">Heads up:</span> once you submit, your
        marks will be locked and cannot be changed.
      </p>
    </div>
  );
}

function Buttons({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();

  // Locked evaluations show a disabled, unmistakable state instead of actions.
  if (locked)
    return (
      <Button type="button" disabled className="w-full sm:w-auto">
        Submitted &amp; locked
      </Button>
    );

  return (
    <div className="space-y-4">
      <LockWarning />
      {/* Full-width, stacked on mobile so both actions stay tappable at 375px. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          name="mode"
          value="draft"
          variant="outline"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="submit"
          name="mode"
          value="submit"
          disabled={pending}
          onClick={(e) => {
            if (
              !confirm(
                "Submit and lock this evaluation? You can't edit it after.",
              )
            )
              e.preventDefault();
          }}
        >
          Submit &amp; lock
        </Button>
      </div>
    </div>
  );
}

export function EvaluationForm({
  roundId,
  teamId,
  criteria,
  initialScores,
  initialComments,
  locked,
}: {
  roundId: string;
  teamId: string;
  criteria: Criterion[];
  initialScores: Record<string, number>;
  initialComments: string;
  locked: boolean;
}) {
  const [state, formAction] = useActionState<EvalState, FormData>(
    saveEvaluation,
    {},
  );
  // Group toggle for the per-criterion View buttons.
  const [revealAll, setRevealAll] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="round_id" value={roundId} />
      <input type="hidden" name="team_id" value={teamId} />

      {locked && (
        <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3">
          <StatusBadge status="locked" />
          <p className="text-sm text-foreground">
            This evaluation has been submitted and is locked.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {/* Marks are masked by default so a score can’t be read off the screen
            by the team being judged; each row has its own View toggle. */}
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted">
            Marks are hidden as you type — use View to check a score.
          </p>
          <button
            type="button"
            onClick={() => setRevealAll((r) => !r)}
            aria-pressed={revealAll}
            className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-violet-bright transition-colors duration-150 hover:bg-surface-raised hover:text-cyan-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
          >
            {revealAll ? "Hide all marks" : "View all marks"}
          </button>
        </div>

        {criteria.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised/50 px-4 py-3 transition-colors duration-150 hover:border-border-strong"
          >
            <div className="min-w-0">
              <Label htmlFor={`score_${c.id}`} className="mb-0">
                {c.name}
              </Label>
              <p className="mt-0.5 text-xs text-muted">
                Max {c.max_marks} · weight {c.weight}
              </p>
            </div>
            <MaskedMarksInput
              id={`score_${c.id}`}
              name={`score_${c.id}`}
              max={Number(c.max_marks)}
              defaultValue={initialScores[c.id] ?? ""}
              disabled={locked}
              reveal={revealAll}
            />
          </div>
        ))}
      </div>

      <div>
        <Label htmlFor="comments">Comments</Label>
        <Textarea
          id="comments"
          name="comments"
          defaultValue={initialComments}
          disabled={locked}
        />
      </div>

      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />

      <Buttons locked={locked} />
    </form>
  );
}
