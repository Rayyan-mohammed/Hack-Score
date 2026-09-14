// Build a local, static copy of a team's private results link — the results
// page and the certificates page — exactly as the team would see them after
// publishing. Nothing is published and nothing is sent.
//
//   node --experimental-strip-types scripts/preview-private-link.mjs [team name]
//
// The pages reuse the app's own compiled CSS from the last `next build`, the
// same markup as the React components, the team's real data, and the real
// certificate-drawing code, so the copy matches the live pages. Output lands
// in email-preview/private-link/site/ — serve that folder to view it.

import { createClient } from "@supabase/supabase-js";
import {
  readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync,
} from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const { computeStandings, round1 } = await import("../src/lib/leaderboard.ts");

const TEAM = process.argv[2] ?? "AstraForge";
const OUT = "email-preview/private-link/site";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- the team's result, computed exactly as getPublicTeamResult does --------
const { data: team } = await db.from("teams")
  .select("id, team_code, name, track, college, hackathon_id, team_leader_name")
  .eq("name", TEAM).is("deleted_at", null).single();
const { data: hk } = await db.from("hackathons").select("name").eq("id", team.hackathon_id).single();
const [{ data: teamRows }, { data: rounds }, { data: members }] = await Promise.all([
  db.from("teams").select("id, team_code, name, track, college, tiebreak_priority")
    .eq("hackathon_id", team.hackathon_id).is("deleted_at", null),
  db.from("rounds").select("id, name").eq("hackathon_id", team.hackathon_id)
    .is("deleted_at", null).order("sort_order", { ascending: true }),
  db.from("team_members").select("name").eq("team_id", team.id).order("id", { ascending: true }),
]);
const { data: evals } = await db.from("evaluations")
  .select("id, round_id, team_id, total_score, status, comments")
  .in("round_id", rounds.map((r) => r.id));

const submitted = new Map();
const feedback = [];
for (const ev of evals ?? []) {
  if (ev.status !== "submitted") continue;
  submitted.set(ev.id, ev.team_id);
  if (ev.team_id === team.id && ev.comments?.trim()) feedback.push(ev.comments.trim());
}
const maxCriterion = {};
const ids = [...submitted.keys()];
for (let i = 0; i < ids.length; i += 200) {
  const { data: scores } = await db.from("evaluation_scores").select("evaluation_id, score")
    .in("evaluation_id", ids.slice(i, i + 200));
  for (const s of scores ?? []) {
    const t = submitted.get(s.evaluation_id);
    if (t) maxCriterion[t] = Math.max(maxCriterion[t] ?? 0, Number(s.score));
  }
}
const standings = computeStandings(teamRows, rounds, evals ?? [], { maxCriterion });
const index = standings.findIndex((s) => s.team.id === team.id);
const standing = standings[index];
const rank = index + 1;
const AWARDS = ["Winner", "Runner-up", "Second runner-up"];
const award = standing && standing.overall > 0 && rank <= 3 ? AWARDS[rank - 1] : "Participant";
const overall = round1(standing.overall);
const roundScores = rounds.map((r) => ({ name: r.name, score: round1(standing.roundAverages[r.id] ?? 0) }));

const people = [
  ...(team.team_leader_name ? [{ name: team.team_leader_name, role: "Team leader" }] : []),
  ...members.map((m, i) => ({ name: m.name, role: `Member ${i + 2}` })),
];

// ---- assets ---------------------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
for (const d of ["_next/static/chunks", "_next/static/media", "certificates", "fonts"])
  mkdirSync(`${OUT}/${d}`, { recursive: true });
const cssFile = readdirSync(".next/static/chunks").find((f) => f.endsWith(".css"));
copyFileSync(`.next/static/chunks/${cssFile}`, `${OUT}/_next/static/chunks/${cssFile}`);
for (const f of readdirSync(".next/static/media"))
  copyFileSync(`.next/static/media/${f}`, `${OUT}/_next/static/media/${f}`);
copyFileSync("public/logo-tight.png", `${OUT}/logo-tight.png`);
copyFileSync("public/certificates/sih-2026-participation.jpg", `${OUT}/certificates/sih-2026-participation.jpg`);
for (const f of ["EBGaramond-Regular.ttf", "EBGaramond-Bold.ttf"])
  copyFileSync(`public/fonts/${f}`, `${OUT}/fonts/${f}`);
writeFileSync(
  `${OUT}/certificate-canvas.js`,
  stripTypeScriptTypes(readFileSync("src/lib/certificate-canvas.ts", "utf8"), { mode: "strip" }),
);

// ---- shared page chrome (root layout + results layout) ---------------------
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT_VARS = "space_grotesk_4f9f433b-module__fJfFLG__variable inter_7b064e0d-module__MOT0tq__variable geist_mono_1bf8cbf6-module__FlyLvG__variable";
const page = (title, body, script = "") => `<!doctype html>
<html lang="en" class="${FONT_VARS} h-full antialiased">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="/_next/static/chunks/${cssFile}"></head>
<body class="flex min-h-full flex-col bg-background text-foreground">
<div class="flex min-h-full flex-1 flex-col"><div class="flex-1">${body}</div></div>
${script}</body></html>`;

const brand = `<div class="mb-8 flex justify-center"><span class="inline-flex max-w-full items-center rounded-md bg-white px-1.5 py-1 ring-1 ring-white/10"><img src="/logo-tight.png" alt="NMIMS" class="w-auto max-w-full object-contain h-14 sm:h-16"></span></div>`;
const badge = (tone, inner) => {
  const tones = {
    violet: "border-violet/40 bg-violet/15 text-violet-bright",
    pink: "border-pink/40 bg-pink/15 text-pink",
  };
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}">${inner}</span>`;
};
const tag = `<svg viewBox="0 0 16 16" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.4 1.75H14.25V7.6a1 1 0 0 1-.3.7l-5.65 5.65a1 1 0 0 1-1.4 0L1.9 9.05a1 1 0 0 1 0-1.4L7.7 2.05a1 1 0 0 1 .7-.3Z"/><circle cx="11" cy="5" r="1" fill="currentColor" stroke="none"/></svg>`;
const medalBg = { 1: "bg-gradient-gold", 2: "bg-gradient-silver", 3: "bg-gradient-bronze" }[rank];
const rankBadge = medalBg
  ? `<span class="inline-flex h-7 w-7 items-center justify-center rounded-lg font-display text-xs font-bold text-background tabular-nums shadow-glow-soft ${medalBg}">${rank}</span>`
  : `<span class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border-strong font-display text-xs font-semibold text-muted tabular-nums">${rank}</span>`;

// ---- /results/<token> -------------------------------------------------------
const resultsBody = `<main class="mx-auto max-w-2xl px-4 py-10">${brand}
<div class="space-y-6">
  <div class="text-center">
    <p class="text-sm text-muted">${esc(hk.name)}</p>
    <h1 class="mt-1 font-display text-3xl font-bold tracking-tight">${esc(team.name)}</h1>
    <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
      <span class="font-mono text-xs text-muted">${esc(team.team_code)}</span>
      ${team.track ? badge("violet", tag + esc(team.track)) : '<span class="text-subtle">—</span>'}
      ${award !== "Participant" ? badge("pink", "🏆 " + esc(award)) : ""}
    </div>
  </div>
  <div class="rounded-2xl border bg-surface shadow-card border-violet/30"><div class="p-5 flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">${rankBadge}<div><p class="text-sm text-muted">Final rank</p>
      <p class="font-display text-xl font-bold">#${rank} <span class="text-sm font-normal text-muted">of ${teamRows.length}</span></p></div></div>
    <div class="text-right"><p class="text-sm text-muted">Overall</p><p class="font-display text-3xl font-bold text-gradient-accent tabular-nums">${overall}</p></div>
  </div></div>
  <div class="rounded-2xl border border-border bg-surface shadow-card"><div class="p-5 pb-0"><h3 class="font-display text-base font-semibold tracking-tight text-foreground">Scores by round</h3></div>
    <div class="p-5 space-y-2">${roundScores.map((r) => `<div class="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-0"><span class="text-muted">${esc(r.name)}</span><span class="font-mono tabular-nums">${r.score}</span></div>`).join("")}</div></div>
  ${feedback.length ? `<div class="rounded-2xl border border-border bg-surface shadow-card"><div class="p-5 pb-0"><h3 class="font-display text-base font-semibold tracking-tight text-foreground">Judge feedback</h3></div>
    <div class="p-5 space-y-3">${feedback.map((f) => `<p class="rounded-lg bg-surface-raised/50 px-3 py-2 text-sm text-muted">${esc(f)}</p>`).join("")}</div></div>` : ""}
  <div class="flex justify-center"><a href="/certificates.html" class="inline-flex h-11 items-center rounded-xl bg-gradient-accent px-6 text-sm font-medium text-white shadow-glow-soft transition-all hover:brightness-110">View certificates</a></div>
</div></main>`;
writeFileSync(`${OUT}/results.html`, page(`${team.name} — Results`, resultsBody));

// ---- /results/<token>/certificate -------------------------------------------
const btn = (label, extra) => `<button class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 ease-out ${extra}">${label}</button>`;
const certBody = `<main class="mx-auto max-w-4xl px-4 py-10">${brand}
<div class="mb-8 text-center">
  <p class="text-sm text-muted">${esc(hk.name)}</p>
  <h1 class="mt-1 font-display text-3xl font-bold tracking-tight">Certificates of Participation</h1>
  <p class="mx-auto mt-2 max-w-lg text-sm text-muted">One for every member of your team. Download them individually, or all together as a single PDF.</p>
  <a href="/results.html" class="mt-3 inline-block text-sm font-medium text-violet-bright hover:text-cyan-bright">← Back to results</a>
</div>
<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <p class="text-sm text-muted">${people.length} certificates for Team <span class="font-medium text-foreground">${esc(team.name)}</span></p>
    ${btn("Download all (PDF)", "bg-gradient-accent text-white shadow-glow-soft h-11 px-4 text-sm sm:h-10")}
  </div>
  <ol class="space-y-8">${people.map((p, i) => `<li class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm"><span class="font-medium text-foreground">${esc(p.name)}</span><span class="text-subtle"> · ${esc(p.role)}</span></p>
      ${btn("Download PNG", "border border-border-strong bg-surface text-foreground h-8 px-3 text-sm")}
    </div>
    <canvas data-i="${i}" width="1366" height="969" class="block h-auto w-full rounded-lg shadow-card"></canvas>
  </li>`).join("")}</ol>
</div></main>`;
const certScript = `<script type="module">
import { prepareTemplate, drawCertificate } from "/certificate-canvas.js";
const people = ${JSON.stringify(people)};
const prep = await prepareTemplate();
for (const c of document.querySelectorAll("canvas[data-i]"))
  drawCertificate(c.getContext("2d"), prep, { name: people[+c.dataset.i].name, team: ${JSON.stringify(team.name)} }, 0.25);
document.body.dataset.ready = "1";
</script>`;
writeFileSync(`${OUT}/certificates.html`, page("Certificates — HackScore", certBody, certScript));

console.log(`${team.team_code} ${team.name}: #${rank} of ${teamRows.length}, ${overall} pts, ${award}`);
console.log(`people: ${people.map((p) => p.name).join(" | ")}`);
console.log(`built ${OUT}/results.html and certificates.html`);
