"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { setTiebreakPriority } from "@/app/admin/teams/actions";
import type { FormState } from "@/app/admin/teams/actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? "Saving…" : "Save priority"}
    </Button>
  );
}

export function TiebreakForm({
  teamId,
  initial,
}: {
  teamId: string;
  initial: number | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    setTiebreakPriority,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="team_id" value={teamId} />
        <div className="sm:max-w-[16rem]">
          <Label htmlFor="priority">Tie-break priority (admin decision)</Label>
          <Input
            id="priority"
            name="priority"
            type="number"
            min={1}
            step={1}
            placeholder="e.g. 1 = ranks first among ties"
            defaultValue={initial ?? ""}
          />
          <p className="mt-1.5 text-xs text-muted">
            Lower ranks higher. Applies only when teams are still level after
            automatic tie-breaks. Leave blank for none.
          </p>
        </div>
        <SaveButton />
      </div>
      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />
    </form>
  );
}
