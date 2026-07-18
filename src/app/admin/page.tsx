import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

async function count(table: string, filter?: [string, string]) {
  const supabase = await createClient();
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter[0], filter[1]);
  // Soft-deleted hackathons/teams shouldn't inflate the dashboard counts.
  if (table === "hackathons" || table === "teams")
    query = query.is("deleted_at", null);
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
      <PageHeader
        title="Dashboard"
        description="Welcome to the HackScore admin panel."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet/10 blur-3xl"
        />
        <CardContent className="relative">
          <p className="text-sm text-muted">
            Start by creating a hackathon, then add rounds, rubrics, teams and
            judges.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
