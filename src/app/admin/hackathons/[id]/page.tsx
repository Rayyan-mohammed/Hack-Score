import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HackathonForm } from "../hackathon-form";
import { updateHackathon, deleteHackathon } from "../actions";

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
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={deleteHackathon}>
            <input type="hidden" name="id" value={hackathon.id} />
            <Button variant="danger" type="submit">
              Delete hackathon
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
