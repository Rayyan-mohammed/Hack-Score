import { Card, CardContent } from "@/components/ui/card";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">
          Welcome to the HackScore admin panel.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Hackathons", value: "—" },
          { label: "Teams", value: "—" },
          { label: "Judges", value: "—" },
          { label: "Evaluations", value: "—" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent>
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent>
          <p className="text-sm text-muted">
            Start by creating a hackathon, then add rounds, rubrics, teams and
            judges.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
