import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TeamForm } from "../../teams-panel";
import { updateTeam } from "../../actions";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select(
      "id, hackathon_id, team_code, name, team_leader_name, team_leader_email, college, track, mentor, problem_statement",
    )
    .eq("id", teamId)
    .is("deleted_at", null)
    .single();

  if (!team) notFound();

  const [{ data: members }, { data: hackathon }] = await Promise.all([
    supabase
      .from("team_members")
      .select("name")
      .eq("team_id", teamId)
      .order("id", { ascending: true }),
    supabase
      .from("hackathons")
      .select("min_team_size, max_team_size")
      .eq("id", team.hackathon_id)
      .single(),
  ]);

  return (
    <div>
      <PageHeader
        title={`Edit ${team.name}`}
        description="Update this team's details, leader and members."
        action={
          <Link
            href={`/admin/teams?h=${team.hackathon_id}`}
            className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
          >
            ← Back to teams
          </Link>
        }
      />
      <Card>
        <CardContent>
          <TeamForm
            action={updateTeam}
            hidden={{ id: team.id }}
            minSize={Number(hackathon?.min_team_size ?? 1)}
            maxSize={Number(hackathon?.max_team_size ?? 6)}
            submitLabel="Save changes"
            initial={{
              team_code: team.team_code,
              name: team.name,
              team_leader_name: team.team_leader_name,
              team_leader_email: team.team_leader_email,
              college: team.college,
              track: team.track,
              mentor: team.mentor,
              problem_statement: team.problem_statement,
              members: (members ?? []).map((m) => m.name).join("; "),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
