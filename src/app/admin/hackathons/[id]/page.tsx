import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteConfirm } from "@/components/delete-confirm";
import { HackathonForm } from "../hackathon-form";
import { updateHackathon, deleteHackathon } from "../actions";
import { RoundsSection } from "../rounds-section";
import { SponsorsManager } from "../sponsors-manager";

export default async function HackathonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: hackathon } = await supabase
    .from("hackathons")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!hackathon) notFound();

  const [{ data: rounds }, { data: sponsors }] = await Promise.all([
    supabase
      .from("rounds")
      .select("id, name, is_active, starts_at, ends_at")
      .eq("hackathon_id", id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("sponsors")
      .select("id, name, logo_url, label, sort_order")
      .eq("hackathon_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={hackathon.name}
        description="Edit event details or manage its rounds."
      />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <HackathonForm
            action={updateHackathon}
            values={hackathon}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sponsors</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Add, edit or remove sponsors at any time — they appear on the
            leaderboard immediately. Order 1 is the title sponsor.
          </p>
        </CardHeader>
        <CardContent>
          <SponsorsManager
            hackathonId={hackathon.id}
            sponsors={sponsors ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rounds</CardTitle>
        </CardHeader>
        <CardContent>
          <RoundsSection hackathonId={hackathon.id} rounds={rounds ?? []} />
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="text-danger">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteConfirm
            action={deleteHackathon}
            fields={{ id: hackathon.id }}
            confirmText={hackathon.name}
            label="Delete hackathon"
            description="This hides the hackathon and its rounds, teams and evaluations. It's recoverable from Trash for 30 days."
          />
        </CardContent>
      </Card>
    </div>
  );
}
