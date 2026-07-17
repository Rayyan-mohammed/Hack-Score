import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

async function count(table: string, filter?: [string, string]) {
  const supabase = await createClient();
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter[0], filter[1]);
  const { count } = await query;
  return count ?? 0;
}

export default async function AdminDashboard() {
  const [hackathons, teams, judges, submitted] = await Promise.all([
    count("hackathons"),
    count("teams"),
    count("profiles", ["role", "judge"]),
    count("evaluations", ["status", "submitted"]),
  ]);

  const stats = [
    { label: "Hackathons", value: hackathons },
    { label: "Teams", value: teams },
    { label: "Judges", value: judges },
    { label: "Submitted evaluations", value: submitted },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">
          Welcome to the HackScore admin panel.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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
