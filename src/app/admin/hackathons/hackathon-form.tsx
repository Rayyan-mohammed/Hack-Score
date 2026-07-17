"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import type { FormState } from "./actions";

type Values = {
  id?: string;
  name?: string;
  description?: string | null;
  venue?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  min_team_size?: number;
  max_team_size?: number;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function HackathonForm({
  action,
  values = {},
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values?: Values;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={values.name ?? ""} required />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={values.description ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="venue">Venue</Label>
        <Input id="venue" name="venue" defaultValue={values.venue ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">Start date</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={values.start_date ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="end_date">End date</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={values.end_date ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="min_team_size">Min team size</Label>
          <Input
            id="min_team_size"
            name="min_team_size"
            type="number"
            min={1}
            defaultValue={values.min_team_size ?? 1}
          />
        </div>
        <div>
          <Label htmlFor="max_team_size">Max team size</Label>
          <Input
            id="max_team_size"
            name="max_team_size"
            type="number"
            min={1}
            defaultValue={values.max_team_size ?? 6}
          />
        </div>
      </div>
      <Toast tone="error" message={state.error} />
      <SubmitButton label={submitLabel} />
    </form>
  );
}
