"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { TrackBadge } from "@/components/ui/badge";
import { ALL_JUDGES } from "@/lib/judges";
import { assignJudge } from "./actions";

export type AssignJudge = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type AssignRound = {
  id: string;
  name: string;
  hackathon_id: string;
  hackathon_name: string | null;
};

export type AssignTeam = {
  id: string;
  hackathon_id: string;
  team_code: string;
  name: string;
  team_leader_name: string | null;
  track: string | null;
  problem_statement_code: string | null;
  problem_statement: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Assigning…" : "Assign"}
    </Button>
  );
}

/**
 * Assign a judge (or the whole panel) to a round, and optionally narrow them
 * to particular teams.
 *
 * Ticking nothing means "this judge scores every team in the round" — the same
 * empty-means-everything rule the round shortlist uses — so the common case
 * stays a two-dropdown form. Ticking a subset is what lets one judge take
 * T01–T05 while another takes T06–T10.
 */
export function AssignJudgeForm({
  judges,
  rounds,
  teams,
  assignedTeams,
}: {
  judges: AssignJudge[];
  rounds: AssignRound[];
  teams: AssignTeam[];
  /** "<roundId>:<judgeId>" -> the team ids that judge already has. */
  assignedTeams: Record<string, string[]>;
}) {
  const [judgeId, setJudgeId] = useState(ALL_JUDGES);
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "");

  const round = rounds.find((r) => r.id === roundId);

  // Only the teams of the event this round belongs to can be scored in it.
  const roundTeams = useMemo(
    () => teams.filter((t) => t.hackathon_id === round?.hackathon_id),
    [teams, round?.hackathon_id],
  );

  // What this judge already has for this round, so the boxes open pre-ticked
  // and saving without touching them changes nothing.
  const saved = useMemo(() => {
    if (judgeId === ALL_JUDGES) return [];
    return assignedTeams[`${roundId}:${judgeId}`] ?? [];
  }, [assignedTeams, roundId, judgeId]);

  // `null` = "follow what's saved"; a Set = the admin has edited the ticks.
  const [edited, setEdited] = useState<Set<string> | null>(null);
  const [editKey, setEditKey] = useState(`${roundId}:${judgeId}`);

  // Changing judge or round abandons unsaved ticks and shows that pair's own.
  const key = `${roundId}:${judgeId}`;
  if (key !== editKey) {
    setEditKey(key);
    setEdited(null);
  }

  const checked = edited ?? new Set(saved);

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEdited(next);
  };

  const allTicked = roundTeams.length > 0 && checked.size === roundTeams.length;

  return (
    <form action={assignJudge} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <Label htmlFor="judge_id">Judge</Label>
          <Select
            id="judge_id"
            name="judge_id"
            value={judgeId}
            onChange={(e) => setJudgeId(e.target.value)}
            required
          >
            <option value={ALL_JUDGES}>All judges ({judges.length})</option>
            {judges.map((j) => (
              <option key={j.id} value={j.id}>
                {j.full_name || j.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor="round_id">Round</Label>
          <Select
            id="round_id"
            name="round_id"
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            required
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.hackathon_name} · {r.name}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton />
      </div>

      <div className="rounded-xl border border-border bg-surface-raised/40 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Teams for this judge
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {checked.size === 0
                ? "Nothing ticked — this judge scores every team in the round."
                : `${checked.size} of ${roundTeams.length} team${
                    roundTeams.length === 1 ? "" : "s"
                  } ticked — this judge scores only these.`}
              {judgeId === ALL_JUDGES && checked.size > 0
                ? " Every judge gets this same set."
                : ""}
            </p>
          </div>
          {roundTeams.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setEdited(
                    allTicked
                      ? new Set()
                      : new Set(roundTeams.map((t) => t.id)),
                  )
                }
              >
                {allTicked ? "Clear all" : "Select all"}
              </Button>
            </div>
          )}
        </div>

        {roundTeams.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No teams in this event yet. Add teams first, or leave this empty to
            assign the judge to the round anyway.
          </p>
        ) : (
          <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-1">
            {roundTeams.map((t) => {
              const on = checked.has(t.id);
              return (
                <li key={t.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-150 ${
                      on
                        ? "border-violet/50 bg-violet/10"
                        : "border-border bg-surface hover:border-violet/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="team_ids"
                      value={t.id}
                      checked={on}
                      onChange={() => toggle(t.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-violet"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted">
                          {t.team_code}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {t.name}
                        </span>
                        {t.track && <TrackBadge track={t.track} />}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {t.team_leader_name || "No leader on record"}
                        {t.problem_statement_code
                          ? ` · ${t.problem_statement_code}`
                          : ""}
                      </span>
                      {t.problem_statement && (
                        <span className="mt-0.5 block truncate text-xs text-subtle">
                          {t.problem_statement}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </form>
  );
}
