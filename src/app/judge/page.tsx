import { Card, CardContent } from "@/components/ui/card";

export default function JudgeDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Evaluations</h1>
        <p className="text-sm text-muted">
          Teams assigned to you for the active round will appear here.
        </p>
      </div>
      <Card>
        <CardContent>
          <p className="text-sm text-muted">
            No assignments yet. An admin will assign you to a round.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
