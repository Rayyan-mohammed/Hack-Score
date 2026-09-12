// Generate certificates for a team (or every team) from the LIVE database, so
// a name corrected in the admin panel is corrected on the certificate too.
//
//   node scripts/generate-certificates.mjs "AstraForge"
//   node scripts/generate-certificates.mjs --all
//
// Each team's people go to certificates/<Team Name>/, leader first.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/generate-certificates.mjs "<team name>" | --all');
  process.exit(1);
}

let query = db
  .from("teams")
  .select("id, team_code, name, team_leader_name")
  .is("deleted_at", null)
  .order("team_code");
if (arg !== "--all") query = query.eq("name", arg);

const { data: teams, error } = await query;
if (error) throw error;
if (!teams?.length) {
  console.error(`No team matched ${JSON.stringify(arg)}.`);
  process.exit(1);
}

const { data: members } = await db
  .from("team_members")
  .select("team_id, name")
  .in("team_id", teams.map((t) => t.id))
  .order("id");

const roster = new Map();
for (const m of members ?? []) {
  if (!roster.has(m.team_id)) roster.set(m.team_id, []);
  roster.get(m.team_id).push(m.name);
}

let total = 0;
for (const team of teams) {
  // The leader is person 1; the rest follow in the order the form listed them.
  const people = [team.team_leader_name, ...(roster.get(team.id) ?? [])].filter(Boolean);
  console.log(`\n${team.team_code} ${team.name} — ${people.length} people`);
  const run = spawnSync("python", ["scripts/make_certificates.py", team.name, ...people], {
    stdio: "inherit",
  });
  if (run.status !== 0) {
    console.error(`  failed for ${team.name}`);
    process.exit(run.status ?? 1);
  }
  total += people.length;
}
console.log(`\n${total} certificate(s) across ${teams.length} team(s).`);
