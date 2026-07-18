import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getTeamEvaluationBreakdown } from "@/lib/evaluations";
import { setTiebreakPriority } from "@/app/admin/teams/actions";
import { TeamDetailView } from "./team-detail-view";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const data = await getTeamEvaluationBreakdown(teamId);
  if (!data) notFound();

  const supabase = await createClient();
  const { data: teamMeta } = await supabase
    .from("teams")
    .select("tiebreak_priority, result_token")
    .eq("id", teamId)
    .single();

  return (
    <div>
      <PageHeader
        title={data.team.name}
        description="Full evaluation breakdown by round and judge."
        action={
          <Link
            href="/admin/leaderboard"
            className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
          >
            ← Back to leaderboard
          </Link>
        }
      />
      <TeamDetailView data={data} />

      {/* Private results / certificate links (share with the team) */}
      {teamMeta?.result_token && (
        <Card className="mt-6">
          <CardContent className="space-y-2">
            <p className="text-sm font-medium">Private links for this team</p>
            <p className="text-xs text-muted">
              Share these with the team. Results are only visible after you
              publish them from the leaderboard.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={`/results/${teamMeta.result_token}`}
                className="text-sm font-medium text-violet-bright hover:text-cyan-bright"
              >
                Results page ↗
              </Link>
              <span className="text-subtle">·</span>
              <Link
                href={`/results/${teamMeta.result_token}/certificate`}
                className="text-sm font-medium text-violet-bright hover:text-cyan-bright"
              >
                Certificate ↗
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual tie-break override (used only when teams are otherwise level) */}
      <Card className="mt-6">
        <CardContent>
          <form
            action={setTiebreakPriority}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
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
                defaultValue={teamMeta?.tiebreak_priority ?? ""}
              />
              <p className="mt-1.5 text-xs text-muted">
                Lower ranks higher. Applies only when teams are still level after
                automatic tie-breaks. Leave blank for none.
              </p>
            </div>
            <Button type="submit" variant="outline">
              Save priority
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
