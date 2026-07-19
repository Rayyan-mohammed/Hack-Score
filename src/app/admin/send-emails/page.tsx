import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyCard } from "@/components/ui/states";
import { isEmailConfigured } from "@/lib/email";
import { ComposeEmails, type Leader } from "./compose-emails";
import { SendHackathonSelect } from "./hackathon-select";

// Bulk send can take a while; allow up to 60s (Vercel Pro; Hobby caps at 10s).
export const maxDuration = 60;

export default async function SendEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>;
}) {
  const { h } = await searchParams;
  const supabase = await createClient();

  const { data: hackathons } = await supabase
    .from("hackathons")
    .select("id, name, start_date, end_date")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list = hackathons ?? [];
  const selected = h || list[0]?.id;
  const selectedHk = list.find((x) => x.id === selected);

  let leaders: Leader[] = [];
  if (selected) {
    const { data: teams } = await supabase
      .from("teams")
      .select("name, college, team_leader_name, team_leader_email")
      .eq("hackathon_id", selected)
      .is("deleted_at", null)
      .order("team_code", { ascending: true });
    leaders = (teams ?? [])
      .filter((t) => t.team_leader_email?.trim())
      .map((t) => ({
        email: t.team_leader_email!.trim(),
        leaderName: t.team_leader_name || "Team leader",
        teamName: t.name,
        college: t.college,
      }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send emails"
        description="Compose and send an email to a hackathon's team leaders."
        action={
          list.length > 0 ? (
            <SendHackathonSelect hackathons={list} selected={selected} />
          ) : undefined
        }
      />

      {!isEmailConfigured() && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <span>⚠️</span>
          <p>
            Email isn&apos;t configured yet. Set the SMTP environment variables
            (Gmail App Password) in your deployment for sending to work — you can
            still compose and preview here.
          </p>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyCard
          title="No hackathons yet"
          description="Create a hackathon and add teams (with leader emails) first."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{selectedHk?.name}</CardTitle>
            <p className="mt-1 text-sm text-muted">
              {leaders.length} team leader{leaders.length === 1 ? "" : "s"} with
              an email on file.
            </p>
          </CardHeader>
          <CardContent>
            <ComposeEmails
              hackathonId={selected!}
              hackathonName={selectedHk?.name ?? ""}
              leaders={leaders}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
