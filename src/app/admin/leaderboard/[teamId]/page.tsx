import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getTeamEvaluationBreakdown } from "@/lib/evaluations";
import { TeamDetailView } from "./team-detail-view";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const data = await getTeamEvaluationBreakdown(teamId);
  if (!data) notFound();

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
    </div>
  );
}
