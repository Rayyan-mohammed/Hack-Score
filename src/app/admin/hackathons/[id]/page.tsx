import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HackathonForm } from "../hackathon-form";
import { updateHackathon, deleteHackathon } from "../actions";
import { RoundsSection } from "../rounds-section";

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
    .single();

  if (!hackathon) notFound();

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, name, is_active, starts_at, ends_at")
    .eq("hackathon_id", id)
    .order("sort_order", { ascending: true });

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
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">
            Deleting this hackathon also removes its rounds, teams and every
            evaluation recorded against it.
          </p>
          <form action={deleteHackathon}>
            <input type="hidden" name="id" value={hackathon.id} />
            <Button variant="destructive" type="submit">
              Delete hackathon
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
