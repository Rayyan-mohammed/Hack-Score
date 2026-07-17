import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { HackathonForm } from "../hackathon-form";
import { createHackathon } from "../actions";

export default function NewHackathonPage() {
  return (
    <div>
      <PageHeader title="New hackathon" description="Set up a new event." />
      <Card>
        <CardContent>
          <HackathonForm action={createHackathon} submitLabel="Create" />
        </CardContent>
      </Card>
    </div>
  );
}
