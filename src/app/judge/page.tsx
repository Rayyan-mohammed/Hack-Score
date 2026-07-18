import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireJudge } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, LiveBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyCard, EmptyState } from "@/components/ui/states";
import { getParticipantsMap, participates } from "@/lib/rounds";

type RoundRef = {
  id: string;
  name: string;
  is_active: boolean;
  hackathon_id: string;
  hackathons: { name: string } | null;
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
          .is("deleted_at", null)
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

  // Only show teams shortlisted into each round (empty shortlist ⇒ all teams).
  const participants = await getParticipantsMap(supabase, roundIds);

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
        <EmptyCard
          title="No rounds assigned"
          description="You haven't been assigned to any rounds yet. An organiser will add you to a judging round shortly."
        />
      )}

      {rounds.map((round) => {
        const roundTeams = teamList.filter(
          (t) =>
            t.hackathon_id === round.hackathon_id &&
            participates(participants, round.id, t.id),
        );
        return (
          <Card key={round.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>
                  {round.hackathons?.name} · {round.name}
                </CardTitle>
                {round.is_active ? (
                  <LiveBadge label="Active round" />
                ) : (
                  <Badge tone="neutral">Inactive</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {roundTeams.length === 0 ? (
                <EmptyState
                  title="No teams in this event yet"
                  description="Teams will appear here once an organiser adds them."
                />
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {roundTeams.map((t) => {
                    const status =
                      evalMap.get(`${round.id}:${t.id}`) ?? "pending";
                    return (
                      <li
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-raised/60"
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
                          <StatusBadge
                            status={status}
                            label={status === "pending" ? "Not started" : undefined}
                          />
                          <Link
                            href={`/judge/rounds/${round.id}/teams/${t.id}`}
                            className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
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
