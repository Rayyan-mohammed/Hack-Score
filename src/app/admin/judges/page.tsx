import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { CreateJudgeForm } from "./create-judge-form";
import { assignJudge, unassignJudge } from "./actions";

type Judge = { id: string; full_name: string | null; email: string | null };
type RoundRow = { id: string; name: string; hackathons: { name: string } | null };
type Assignment = {
  round_id: string;
  judge_id: string;
  rounds: { name: string; hackathons: { name: string } | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function JudgesPage() {
  const supabase = await createClient();

  const [{ data: judges }, { data: rounds }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "judge")
        .order("full_name", { ascending: true }),
      supabase
        .from("rounds")
        .select("id, name, hackathons(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("round_judges")
        .select(
          "round_id, judge_id, rounds(name, hackathons(name)), profiles(full_name, email)",
        ),
    ]);

  const judgeList = (judges as Judge[]) ?? [];
  const roundList = (rounds as unknown as RoundRow[]) ?? [];
  const assignList = (assignments as unknown as Assignment[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Judges"
        description="Create judge accounts and assign them to rounds."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create a judge account</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateJudgeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Judges ({judgeList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {judgeList.length === 0 ? (
            <p className="text-sm text-muted">No judges yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {judgeList.map((j) => (
                <li key={j.id} className="px-4 py-3">
                  <p className="font-medium">{j.full_name || "—"}</p>
                  <p className="text-xs text-muted">{j.email}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign a judge to a round</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {judgeList.length === 0 || roundList.length === 0 ? (
            <p className="text-sm text-muted">
              You need at least one judge and one round first.
            </p>
          ) : (
            <form action={assignJudge} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Judge</label>
                <select
                  name="judge_id"
                  required
                  className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
                >
                  {judgeList.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.full_name || j.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Round</label>
                <select
                  name="round_id"
                  required
                  className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
                >
                  {roundList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.hackathons?.name} · {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm">
                Assign
              </Button>
            </form>
          )}

          {assignList.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>Judge</TH>
                  <TH>Hackathon</TH>
                  <TH>Round</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {assignList.map((a) => (
                  <TR key={`${a.round_id}-${a.judge_id}`}>
                    <TD className="font-medium">
                      {a.profiles?.full_name || a.profiles?.email}
                    </TD>
                    <TD className="text-muted">
                      {a.rounds?.hackathons?.name ?? "—"}
                    </TD>
                    <TD className="text-muted">{a.rounds?.name ?? "—"}</TD>
                    <TD className="text-right">
                      <form action={unassignJudge}>
                        <input type="hidden" name="judge_id" value={a.judge_id} />
                        <input type="hidden" name="round_id" value={a.round_id} />
                        <Button variant="ghost" size="sm" type="submit">
                          Remove
                        </Button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
