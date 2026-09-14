// Render the "Results Published" email exactly as publishing would, to local
// HTML files — nothing is sent and nothing is published.
//
//   node scripts/preview-results-email.mjs [output-folder]
//
// Uses the live database and the same scoring and template code the publish
// action uses, for representative teams — the winner, a runner-up, AstraForge
// and a mid-table participant — so every variant of the email can be checked.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
// Both modules are import-free TypeScript, which Node loads directly.
const { resultEmailHtml, resultEmailText } = await import(
  "../src/lib/email-templates.ts"
);
const { computeStandings, round1 } = await import("../src/lib/leaderboard.ts");

const outDir = process.argv[2] ?? "email-preview";
const ORIGIN = "https://nmims-hack-score.vercel.app";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: hk } = await db
  .from("hackathons")
  .select("id, name")
  .is("deleted_at", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

const [{ data: teamRows }, { data: rounds }] = await Promise.all([
  db
    .from("teams")
    .select(
      "id, team_code, name, track, college, tiebreak_priority, team_leader_name, team_leader_email, result_token",
    )
    .eq("hackathon_id", hk.id)
    .is("deleted_at", null),
  db
    .from("rounds")
    .select("id, name")
    .eq("hackathon_id", hk.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true }),
]);

const roundIds = rounds.map((r) => r.id);
const { data: criteria } = await db.from("rubric_criteria").select("round_id, max_marks").in("round_id", roundIds);
const roundMax = new Map();
for (const c of criteria ?? []) roundMax.set(c.round_id, (roundMax.get(c.round_id) ?? 0) + Number(c.max_marks));
const { data: evalRows } = await db
  .from("evaluations")
  .select("id, round_id, team_id, total_score, status, comments")
  .in("round_id", roundIds);

const feedbackByTeam = new Map();
const submitted = new Map();
for (const ev of evalRows ?? []) {
  if (ev.status !== "submitted") continue;
  submitted.set(ev.id, ev.team_id);
  if (ev.comments?.trim()) {
    const list = feedbackByTeam.get(ev.team_id) ?? [];
    list.push(ev.comments.trim());
    feedbackByTeam.set(ev.team_id, list);
  }
}
const maxCriterion = {};
const ids = [...submitted.keys()];
for (let i = 0; i < ids.length; i += 200) {
  const { data: scores } = await db
    .from("evaluation_scores")
    .select("evaluation_id, score")
    .in("evaluation_id", ids.slice(i, i + 200));
  for (const s of scores ?? []) {
    const t = submitted.get(s.evaluation_id);
    if (t) maxCriterion[t] = Math.max(maxCriterion[t] ?? 0, Number(s.score));
  }
}

const standings = computeStandings(teamRows, rounds, evalRows ?? [], { maxCriterion });
const AWARDS = ["Winner", "Runner-up", "Second runner-up"];

function payloadFor(index) {
  const s = standings[index];
  const team = teamRows.find((t) => t.id === s.team.id);
  const rank = index + 1;
  const overall = round1(s.overall);
  const resultsUrl = `${ORIGIN}/results/${team.result_token}`;
  return {
    leaderName: team.team_leader_name || "Team leader",
    teamName: team.name,
    teamCode: team.team_code,
    track: team.track,
    award: overall > 0 && rank <= 3 ? AWARDS[rank - 1] : "Participant",
    hackathonName: hk.name,
    rank,
    totalTeams: teamRows.length,
    overall,
    overallMax: rounds.reduce((sum, r) => sum + (roundMax.get(r.id) ?? 0), 0) || undefined,
    rounds: rounds.map((r) => ({ name: r.name, score: round1(s.roundAverages[r.id] ?? 0), maxMarks: roundMax.get(r.id) || undefined })),
    feedback: feedbackByTeam.get(team.id) ?? [],
    resultsUrl,
    certificateUrl: `${resultsUrl}/certificate`,
  };
}

const astraIndex = standings.findIndex((s) => s.team.name === "AstraForge");
const picks = [
  ["1-winner", 0],
  ["2-runner-up", 1],
  ["3-astraforge", astraIndex >= 0 ? astraIndex : standings.length - 1],
  // Someone outside the podium, for the plain "Participant" version.
  ["4-participant", Math.min(14, standings.length - 1)],
];

mkdirSync(outDir, { recursive: true });
for (const [label, index] of picks) {
  const p = payloadFor(index);
  writeFileSync(`${outDir}/${label}.html`, resultEmailHtml(p));
  writeFileSync(`${outDir}/${label}.txt`, resultEmailText(p));
  console.log(
    `${outDir}/${label}.html  — #${p.rank} ${p.teamCode} ${p.teamName} (${p.overall} pts, ${p.award}) -> would go to ${teamRows.find((t) => t.team_code === p.teamCode).team_leader_email}`,
  );
}
console.log(`\nSubject line: Results Published — ${hk.name}`);
