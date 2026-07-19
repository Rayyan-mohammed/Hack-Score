"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { updateRound, type FormState } from "./round-actions";

type Round = {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save round"}
    </Button>
  );
}

// datetime-local wants "YYYY-MM-DDTHH:mm"; trim the trailing seconds/zone.
function toLocalInput(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

// DD-MM-YYYY for the helper text.
function dmy(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

export function RoundForm({
  round,
  hackathonStart,
  hackathonEnd,
}: {
  round: Round;
  hackathonStart: string | null;
  hackathonEnd: string | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateRound,
    {},
  );

  // Bound the datetime pickers to the hackathon window so out-of-range days
  // are disabled in the calendar (the server enforces this too).
  const minDT = hackathonStart ? `${hackathonStart.slice(0, 10)}T00:00` : undefined;
  const maxDT = hackathonEnd ? `${hackathonEnd.slice(0, 10)}T23:59` : undefined;
  const windowNote =
    hackathonStart || hackathonEnd
      ? `Must be within the hackathon period (${dmy(hackathonStart) ?? "—"} to ${
          dmy(hackathonEnd) ?? "—"
        }).`
      : null;

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <input type="hidden" name="id" value={round.id} />
      <input type="hidden" name="hackathon_id" value={round.hackathon_id} />
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={round.name} required />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={round.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="starts_at">Starts at</Label>
          <Input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            defaultValue={toLocalInput(round.starts_at)}
            min={minDT}
            max={maxDT}
            title={maxDT ? `Cannot be after ${dmy(hackathonEnd)}` : undefined}
          />
        </div>
        <div>
          <Label htmlFor="ends_at">Ends at</Label>
          <Input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={toLocalInput(round.ends_at)}
            min={minDT}
            max={maxDT}
            title={maxDT ? `Cannot be after ${dmy(hackathonEnd)}` : undefined}
          />
        </div>
      </div>
      {windowNote && <p className="text-xs text-muted">{windowNote}</p>}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={round.is_active}
          className="h-4 w-4 rounded border-border"
        />
        Active round (judges can evaluate)
      </label>
      <Toast tone="error" message={state.error} />
      <SaveButton />
    </form>
  );
}
