"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createRound, type FormState } from "./round-actions";

type Round = {
  id: string;
  name: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add round"}
    </Button>
  );
}

export function RoundsSection({
  hackathonId,
  rounds,
}: {
  hackathonId: string;
  rounds: Round[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createRound,
    {},
  );

  return (
    <div className="space-y-4">
      {rounds.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rounds.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted">
                  {r.is_active ? "Active" : "Inactive"}
                </p>
              </div>
              <Link
                href={`/admin/hackathons/${hackathonId}/rounds/${r.id}`}
                className="text-sm font-medium text-primary"
              >
                Rubric & settings
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form
        action={formAction}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4"
      >
        <input type="hidden" name="hackathon_id" value={hackathonId} />
        <div className="min-w-48 flex-1">
          <Label htmlFor="round_name">New round name</Label>
          <Input id="round_name" name="name" placeholder="e.g. Round 1" required />
        </div>
        <div className="w-28">
          <Label htmlFor="sort_order">Order</Label>
          <Input
            id="sort_order"
            name="sort_order"
            type="number"
            defaultValue={rounds.length + 1}
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
