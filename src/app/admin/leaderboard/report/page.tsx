import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{hackathon.name}</h1>
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
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {medals[i]}
              </p>
              <p className="mt-1 font-semibold">{s.team.name}</p>
              <p className="text-sm text-muted">
                {s.team.team_code} · {round1(s.overall)} pts
              </p>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Full rankings</h2>
        <Table>
          <THead>
            <TR>
              <TH>#</TH>
              <TH>Team</TH>
              <TH>Track</TH>
              {rounds.map((rd) => (
                <TH key={rd.id}>{rd.name}</TH>
              ))}
              <TH>Overall</TH>
            </TR>
          </THead>
          <tbody>
            {standings.map((s, i) => (
              <TR key={s.team.id}>
                <TD className="font-medium">{i + 1}</TD>
                <TD>
                  <span className="font-mono text-xs text-muted">
                    {s.team.team_code}
                  </span>{" "}
                  {s.team.name}
                </TD>
                <TD className="text-muted">{s.team.track ?? "—"}</TD>
                {rounds.map((rd) => (
                  <TD key={rd.id} className="text-muted">
                    {round1(s.roundAverages[rd.id] ?? 0)}
                  </TD>
                ))}
                <TD className="font-semibold">{round1(s.overall)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
