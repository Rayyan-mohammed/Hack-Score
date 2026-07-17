import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoundForm } from "../../../round-form";
import { RubricBuilder } from "../../../rubric-builder";
import { deleteRound } from "../../../round-actions";

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string; roundId: string }>;
}) {
  const { id, roundId } = await params;
  const supabase = await createClient();

  const { data: round } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", roundId)
    .single();

  if (!round) notFound();

  const { data: criteria } = await supabase
    .from("rubric_criteria")
    .select("id, name, max_marks, weight")
    .eq("round_id", roundId)
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title={round.name}
        description="Configure this round and its scoring rubric."
        action={
          <Link
            href={`/admin/hackathons/${id}`}
            className="text-sm font-medium text-primary"
          >
            ← Back to hackathon
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Round settings</CardTitle>
        </CardHeader>
        <CardContent>
          <RoundForm round={round} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rubric</CardTitle>
        </CardHeader>
        <CardContent>
          <RubricBuilder
            hackathonId={id}
            roundId={roundId}
            criteria={criteria ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={deleteRound}>
            <input type="hidden" name="id" value={round.id} />
            <input type="hidden" name="hackathon_id" value={id} />
            <Button variant="danger" type="submit">
              Delete round
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
