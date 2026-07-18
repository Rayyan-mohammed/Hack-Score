import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getJudgeProgress } from "@/lib/judge-progress";
import { JudgeProgressView } from "./judge-progress-view";

export default async function JudgeDetailPage({
  params,
}: {
  params: Promise<{ judgeId: string }>;
}) {
  const { judgeId } = await params;
  const data = await getJudgeProgress(judgeId);
  if (!data) notFound();

  return (
    <div>
      <PageHeader
        title={data.judge.full_name || data.judge.email || "Judge"}
        description={data.judge.email ?? undefined}
        action={
          <Link
            href="/admin/judges"
            className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
          >
            ← Back to judges
          </Link>
        }
      />
      <JudgeProgressView data={data} />
    </div>
  );
}
