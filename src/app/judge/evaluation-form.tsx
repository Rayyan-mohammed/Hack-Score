"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { saveEvaluation, type EvalState } from "./actions";

type Criterion = { id: string; name: string; max_marks: number; weight: number };

function Buttons({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();
  if (locked) return null;
  return (
    <div className="flex gap-3">
      <Button type="submit" name="mode" value="draft" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save draft"}
      </Button>
      <Button
        type="submit"
        name="mode"
        value="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("Submit and lock this evaluation? You can't edit it after."))
            e.preventDefault();
        }}
      >
        Submit
      </Button>
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

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="round_id" value={roundId} />
      <input type="hidden" name="team_id" value={teamId} />

      {locked && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          This evaluation has been submitted and is locked.
        </div>
      )}

      <div className="space-y-4">
        {criteria.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor={`score_${c.id}`} className="mb-0">
                {c.name}
              </Label>
              <p className="text-xs text-muted">
                Max {c.max_marks} · weight {c.weight}
              </p>
            </div>
            <Input
              id={`score_${c.id}`}
              name={`score_${c.id}`}
              type="number"
              min={0}
              max={c.max_marks}
              step="0.5"
              defaultValue={initialScores[c.id] ?? ""}
              disabled={locked}
              className="w-28"
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

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && (
        <p className="text-sm text-green-600">{state.message}</p>
      )}

      <Buttons locked={locked} />
    </form>
  );
}
