import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireJudge } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrackBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { EvaluationForm } from "../../../../evaluation-form";

export default async function EvaluatePage({
  params,
}: {
  params: Promise<{ roundId: string; teamId: string }>;
}) {
  const { roundId, teamId } = await params;
  const { user } = await requireJudge();
  const supabase = await createClient();

  const [{ data: round }, { data: team }, { data: criteria }] =
    await Promise.all([
      supabase
        .from("rounds")
        .select("id, name, hackathons(name)")
        .eq("id", roundId)
        .single(),
      supabase
        .from("teams")
        .select("id, team_code, name, track, problem_statement")
        .eq("id", teamId)
        .single(),
      supabase
        .from("rubric_criteria")
        .select("id, name, max_marks, weight")
        .eq("round_id", roundId)
        .order("sort_order", { ascending: true }),
    ]);

  if (!round || !team) notFound();

  const { data: evaluation } = await supabase
    .from("evaluations")
    .select("id, status, comments")
    .eq("round_id", roundId)
    .eq("team_id", teamId)
    .eq("judge_id", user!.id)
    .maybeSingle();

  const initialScores: Record<string, number> = {};
  if (evaluation) {
    const { data: scores } = await supabase
      .from("evaluation_scores")
      .select("criterion_id, score")
      .eq("evaluation_id", evaluation.id);
    for (const s of scores ?? []) initialScores[s.criterion_id] = s.score;
  }

  const hackName = (round as unknown as { hackathons: { name: string } | null })
    .hackathons?.name;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={team.name}
        description={`${hackName ?? ""} · ${round.name}`}
        action={
          <Link
            href="/judge"
            className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
          >
            ← Back
          </Link>
        }
      />

      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted">{team.team_code}</span>
        <TrackBadge track={team.track} />
      </div>

      {team.problem_statement && (
        <Card>
          <CardHeader>
            <CardTitle>Problem statement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">{team.problem_statement}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          {(criteria ?? []).length === 0 ? (
            <EmptyState
              title="No rubric criteria yet"
              description="An organiser needs to add scoring criteria to this round before it can be judged."
            />
          ) : (
            <EvaluationForm
              roundId={roundId}
              teamId={teamId}
              criteria={criteria ?? []}
              initialScores={initialScores}
              initialComments={evaluation?.comments ?? ""}
              locked={evaluation?.status === "submitted"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
