"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import type { FormState } from "./actions";
import { EVENT_TIME_ZONE } from "@/lib/datetime";

type Values = {
  id?: string;
  name?: string;
  description?: string | null;
  venue?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  evaluation_deadline?: string | null;
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

/** ISO instant -> the "YYYY-MM-DDTHH:mm" a datetime-local input expects,
 *  expressed in the event's timezone rather than the browser's. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
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

  // Controlled so each picker bounds the other: end can't precede start, and
  // start can't follow end (dates outside the range are disabled in the picker).
  const [startDate, setStartDate] = useState(values.start_date ?? "");
  const [endDate, setEndDate] = useState(values.end_date ?? "");

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
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="end_date">End date</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            value={endDate}
            min={startDate || undefined}
            title={
              startDate ? `Must be on or after ${startDate}` : undefined
            }
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="evaluation_deadline">
          Scoring deadline <span className="text-subtle">(optional)</span>
        </Label>
        <Input
          id="evaluation_deadline"
          name="evaluation_deadline"
          type="datetime-local"
          defaultValue={toLocalInput(values.evaluation_deadline)}
        />
        <p className="mt-1 text-xs text-subtle">
          At this moment every draft a judge has saved but not submitted is
          submitted automatically, as it stands. Judges see a countdown. Leave
          blank and drafts stay open indefinitely.
        </p>
      </div>

      {startDate && endDate && startDate > endDate && (
        <p className="text-xs text-warning">
          End date is before the start date — please fix before saving.
        </p>
      )}
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
      <Toast tone="success" message={state.message} />
      <SubmitButton label={submitLabel} />
    </form>
  );
}
