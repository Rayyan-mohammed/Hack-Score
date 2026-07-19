"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toast } from "@/components/ui/toast";
import { setRoundParticipants, type FormState } from "./round-actions";

export type ParticipantTeam = {
  id: string;
  team_code: string;
  name: string;
  prevScore: number | null;
};

function SaveButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : `Save shortlist (${count})`}
    </Button>
  );
}

export function ParticipantsForm({
  roundId,
  hackathonId,
  teams,
  selected,
  hasShortlist,
  prevRoundName,
}: {
  roundId: string;
  hackathonId: string;
  teams: ParticipantTeam[];
  selected: string[];
  hasShortlist: boolean;
  prevRoundName: string | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    setRoundParticipants,
    {},
  );
  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set(selected),
  );

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const all = () => setChecked(new Set(teams.map((t) => t.id)));
  const clear = () => setChecked(new Set());

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="round_id" value={roundId} />
      <input type="hidden" name="hackathon_id" value={hackathonId} />

      {!hasShortlist && (
        <p className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2 text-sm text-muted">
          No shortlist yet — <span className="text-foreground">all teams</span>{" "}
          currently participate in this round. Select a subset below to shortlist
          them; clearing the selection restores “all teams”.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={all}>
          Select all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Clear
        </Button>
        <span className="ml-auto text-sm text-muted">
          {checked.size} of {teams.length} selected
        </span>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {teams.map((t) => {
          const isOn = checked.has(t.id);
          return (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-raised/60">
                <input
                  type="checkbox"
                  name="team_ids"
                  value={t.id}
                  checked={isOn}
                  onChange={() => toggle(t.id)}
                  className="h-4 w-4 shrink-0 accent-violet"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-xs text-muted">
                    {t.team_code}
                  </span>{" "}
                  <span className="font-medium">{t.name}</span>
                </span>
                {prevRoundName && (
                  <Badge tone={t.prevScore ? "cyan" : "neutral"}>
                    {t.prevScore !== null ? `${t.prevScore}` : "—"}
                  </Badge>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {prevRoundName && (
        <p className="text-xs text-subtle">
          Scores shown are each team’s average in “{prevRoundName}”.
        </p>
      )}

      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />
      <SaveButton count={checked.size} />
    </form>
  );
}
