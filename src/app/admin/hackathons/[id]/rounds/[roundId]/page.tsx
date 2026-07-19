import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteConfirm } from "@/components/delete-confirm";
import { RoundForm } from "../../../round-form";
import { RubricBuilder } from "../../../rubric-builder";
import { ParticipantsForm } from "../../../participants-form";
import { deleteRound } from "../../../round-actions";
import { round1 } from "@/lib/leaderboard";

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string; roundId: string }>;
}) {
  const { id, roundId } = await params;
  const supabase = await createClient();

  const { data: round } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", roundId)
    .is("deleted_at", null)
    .single();

  if (!round) notFound();

  const { data: criteria } = await supabase
    .from("rubric_criteria")
    .select("id, name, max_marks, weight")
    .eq("round_id", roundId)
    .order("sort_order", { ascending: true });

  // --- Shortlisting data -------------------------------------------------
  const [
    { data: teamRows },
    { data: shortlist },
    { data: allRounds },
    { data: hackathon },
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, team_code, name")
      .eq("hackathon_id", round.hackathon_id)
      .is("deleted_at", null)
      .order("team_code", { ascending: true }),
    supabase.from("round_teams").select("team_id").eq("round_id", roundId),
    supabase
      .from("rounds")
      .select("id, name, sort_order")
      .eq("hackathon_id", round.hackathon_id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("hackathons")
      .select("start_date, end_date")
      .eq("id", round.hackathon_id)
      .single(),
  ]);

  const teams = teamRows ?? [];
  const shortlisted = new Set((shortlist ?? []).map((r) => r.team_id));
  const hasShortlist = shortlisted.size > 0;

  // Find the round immediately before this one (by sort order) to surface its
  // scores as a shortlisting aid.
  const ordered = allRounds ?? [];
  const idx = ordered.findIndex((r) => r.id === roundId);
  const prevRound = idx > 0 ? ordered[idx - 1] : null;

  const prevScore = new Map<string, number>();
  if (prevRound) {
    const { data: prevEvals } = await supabase
      .from("evaluations")
      .select("team_id, total_score, status")
      .eq("round_id", prevRound.id)
      .eq("status", "submitted");
    const agg = new Map<string, { sum: number; n: number }>();
    for (const e of prevEvals ?? []) {
      const a = agg.get(e.team_id) ?? { sum: 0, n: 0 };
      a.sum += Number(e.total_score);
      a.n += 1;
      agg.set(e.team_id, a);
    }
    for (const [tid, a] of agg) prevScore.set(tid, round1(a.sum / a.n));
  }

  const participantTeams = teams
    .map((t) => ({
      id: t.id,
      team_code: t.team_code,
      name: t.name,
      prevScore: prevScore.has(t.id) ? prevScore.get(t.id)! : null,
    }))
    // When a previous round exists, order by its score so top teams sort first.
    .sort((a, b) =>
      prevRound
        ? (b.prevScore ?? -1) - (a.prevScore ?? -1) ||
          a.team_code.localeCompare(b.team_code)
        : a.team_code.localeCompare(b.team_code),
    );

  // Which team ids to pre-check: the current shortlist, or all when none set.
  const selected = hasShortlist ? [...shortlisted] : teams.map((t) => t.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={round.name}
        description="Configure this round and its scoring rubric."
        action={
          <Link
            href={`/admin/hackathons/${id}`}
            className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
          >
            ← Back to hackathon
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Round settings</CardTitle>
        </CardHeader>
        <CardContent>
          <RoundForm
            round={round}
            hackathonStart={hackathon?.start_date ?? null}
            hackathonEnd={hackathon?.end_date ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rubric</CardTitle>
        </CardHeader>
        <CardContent>
          <RubricBuilder
            hackathonId={id}
            roundId={roundId}
            criteria={criteria ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participating teams (shortlist)</CardTitle>
          <p className="mt-1 text-sm text-muted">
            {prevRound
              ? `Promote teams into this round — scores from “${prevRound.name}” are shown to help you pick.`
              : "Choose which teams take part in this round. Leave all selected for the opening round."}
          </p>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted">
              Add teams to this hackathon first.
            </p>
          ) : (
            <ParticipantsForm
              roundId={roundId}
              hackathonId={id}
              teams={participantTeams}
              selected={selected}
              hasShortlist={hasShortlist}
              prevRoundName={prevRound?.name ?? null}
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="text-danger">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteConfirm
            action={deleteRound}
            fields={{ id: round.id, hackathon_id: id }}
            confirmText={round.name}
            label="Delete round"
            description="This hides the round with its rubric and evaluations. It's recoverable from Trash for 30 days."
          />
        </CardContent>
      </Card>
    </div>
  );
}
