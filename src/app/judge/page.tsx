import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireJudge } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RoundRef = {
  id: string;
  name: string;
  is_active: boolean;
  hackathon_id: string;
  hackathons: { name: string } | null;
};

const statusBadge: Record<string, string> = {
  submitted: "bg-green-100 text-green-700",
  draft: "bg-amber-100 text-amber-700",
  pending: "bg-slate-100 text-slate-600",
};

export default async function JudgeDashboard() {
  const { user } = await requireJudge();
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("round_judges")
    .select("rounds(id, name, is_active, hackathon_id, hackathons(name))")
    .eq("judge_id", user!.id);

  const rounds =
    (assignments
      ?.map((a) => (a as unknown as { rounds: RoundRef }).rounds)
      .filter(Boolean) as RoundRef[]) ?? [];

  const roundIds = rounds.map((r) => r.id);
  const hackathonIds = [...new Set(rounds.map((r) => r.hackathon_id))];

  const [{ data: teams }, { data: myEvals }] = await Promise.all([
    hackathonIds.length
      ? supabase
          .from("teams")
          .select("id, team_code, name, hackathon_id")
          .in("hackathon_id", hackathonIds)
          .order("team_code", { ascending: true })
      : Promise.resolve({ data: [] }),
    roundIds.length
      ? supabase
          .from("evaluations")
          .select("round_id, team_id, status")
          .eq("judge_id", user!.id)
          .in("round_id", roundIds)
      : Promise.resolve({ data: [] }),
  ]);

  const teamList =
    (teams as { id: string; team_code: string; name: string; hackathon_id: string }[]) ??
    [];
  const evalMap = new Map<string, string>();
  for (const e of (myEvals as { round_id: string; team_id: string; status: string }[]) ??
    []) {
    evalMap.set(`${e.round_id}:${e.team_id}`, e.status);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Evaluations"
        description="Score the teams assigned to your rounds."
      />

      {rounds.length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-muted">
              You haven&apos;t been assigned to any rounds yet.
            </p>
          </CardContent>
        </Card>
      )}

      {rounds.map((round) => {
        const roundTeams = teamList.filter(
          (t) => t.hackathon_id === round.hackathon_id,
        );
        return (
          <Card key={round.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>
                  {round.hackathons?.name} · {round.name}
                </CardTitle>
                {!round.is_active && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    Inactive
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {roundTeams.length === 0 ? (
                <p className="text-sm text-muted">No teams in this event yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {roundTeams.map((t) => {
                    const status =
                      evalMap.get(`${round.id}:${t.id}`) ?? "pending";
                    return (
                      <li
                        key={t.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">
                            <span className="font-mono text-xs text-muted">
                              {t.team_code}
                            </span>{" "}
                            {t.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[status]}`}
                          >
                            {status === "pending" ? "Not started" : status}
                          </span>
                          <Link
                            href={`/judge/rounds/${round.id}/teams/${t.id}`}
                            className="text-sm font-medium text-primary"
                          >
                            {status === "submitted" ? "View" : "Evaluate"}
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
