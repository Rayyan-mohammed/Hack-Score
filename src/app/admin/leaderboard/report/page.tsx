import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { RankBadge } from "@/components/ui/badge";
import {
  computeStandings,
  round1,
  type EvalRow,
  type RoundRow,
  type TeamRow,
} from "@/lib/leaderboard";
import { PrintButton } from "./print-button";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>;
}) {
  const { h } = await searchParams;
  if (!h) notFound();

  const supabase = await createClient();
  const { data: hackathon } = await supabase
    .from("hackathons")
    .select("name, venue, start_date, end_date")
    .eq("id", h)
    .single();

  if (!hackathon) notFound();

  const [{ data: t }, { data: r }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, team_code, name, track, college")
      .eq("hackathon_id", h),
    supabase
      .from("rounds")
      .select("id, name")
      .eq("hackathon_id", h)
      .order("sort_order", { ascending: true }),
  ]);

  const teams = (t as TeamRow[]) ?? [];
  const rounds = (r as RoundRow[]) ?? [];
  const roundIds = rounds.map((x) => x.id);

  let evals: EvalRow[] = [];
  if (roundIds.length) {
    const { data: e } = await supabase
      .from("evaluations")
      .select("round_id, team_id, total_score, status")
      .in("round_id", roundIds);
    evals = (e as EvalRow[]) ?? [];
  }

  const standings = computeStandings(teams, rounds, evals);
  const winners = standings.filter((s) => s.overall > 0).slice(0, 3);
  const medals = ["Winner", "Runner-up", "Second runner-up"];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {hackathon.name}
          </h1>
          <p className="text-sm text-muted">
            {hackathon.venue ? `${hackathon.venue} · ` : ""}
            {hackathon.start_date ?? ""}
            {hackathon.end_date ? ` → ${hackathon.end_date}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">Results report</p>
        </div>
        <div className="no-print">
          <PrintButton />
        </div>
      </div>

      {winners.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {winners.map((s, i) => (
            <div
              key={s.team.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-center gap-2">
                <RankBadge rank={i + 1} />
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  {medals[i]}
                </p>
              </div>
              <p className="mt-2 font-display font-semibold">{s.team.name}</p>
              <p className="text-sm text-muted">
                {s.team.team_code} · {round1(s.overall)} pts
              </p>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold">
          Full rankings
        </h2>
        <Table>
          <THead>
            <TR>
              <TH>#</TH>
              <TH>Team</TH>
              <TH>Track</TH>
              {rounds.map((rd) => (
                <TH key={rd.id} className="text-right">
                  {rd.name}
                </TH>
              ))}
              <TH className="text-right">Overall</TH>
            </TR>
          </THead>
          <tbody>
            {standings.map((s, i) => (
              <TR key={s.team.id}>
                <TD>
                  <RankBadge rank={i + 1} />
                </TD>
                <TD>
                  <span className="font-mono text-xs text-muted">
                    {s.team.team_code}
                  </span>{" "}
                  <span className="font-medium">{s.team.name}</span>
                </TD>
                <TD className="text-muted">{s.team.track ?? "—"}</TD>
                {rounds.map((rd) => (
                  <TD key={rd.id} className="text-right text-muted tabular-nums">
                    {round1(s.roundAverages[rd.id] ?? 0)}
                  </TD>
                ))}
                <TD className="text-right font-display font-semibold tabular-nums">
                  {round1(s.overall)}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
