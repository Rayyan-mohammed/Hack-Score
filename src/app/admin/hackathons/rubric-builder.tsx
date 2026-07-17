"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { addCriterion, deleteCriterion, type FormState } from "./round-actions";

type Criterion = {
  id: string;
  name: string;
  max_marks: number;
  weight: number;
};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add criterion"}
    </Button>
  );
}

export function RubricBuilder({
  hackathonId,
  roundId,
  criteria,
}: {
  hackathonId: string;
  roundId: string;
  criteria: Criterion[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    addCriterion,
    {},
  );

  const total = criteria.reduce((sum, c) => sum + Number(c.max_marks), 0);

  return (
    <div className="space-y-4">
      {criteria.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {criteria.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted">
                  Max {c.max_marks} · weight {c.weight}
                </p>
              </div>
              <form action={deleteCriterion}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="round_id" value={roundId} />
                <input type="hidden" name="hackathon_id" value={hackathonId} />
                <Button variant="ghost" size="sm" type="submit">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {criteria.length > 0 && (
        <p className="text-sm text-muted">
          Total possible marks: <span className="font-medium">{total}</span>
        </p>
      )}

      <form
        action={formAction}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4"
      >
        <input type="hidden" name="round_id" value={roundId} />
        <input type="hidden" name="hackathon_id" value={hackathonId} />
        <div className="min-w-48 flex-1">
          <Label htmlFor="crit_name">Criterion</Label>
          <Input
            id="crit_name"
            name="name"
            placeholder="e.g. Innovation"
            required
          />
        </div>
        <div className="w-28">
          <Label htmlFor="max_marks">Max marks</Label>
          <Input
            id="max_marks"
            name="max_marks"
            type="number"
            min={1}
            defaultValue={10}
            required
          />
        </div>
        <div className="w-24">
          <Label htmlFor="weight">Weight</Label>
          <Input
            id="weight"
            name="weight"
            type="number"
            min={0}
            step="0.1"
            defaultValue={1}
          />
        </div>
        <AddButton />
        {state.error && (
          <p className="w-full text-sm text-red-600">{state.error}</p>
        )}
      </form>
    </div>
  );
}
