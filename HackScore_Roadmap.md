# HackScore — Smart Hackathon Evaluation & Judging Platform
## Detailed Development Roadmap

**Prepared for:** Mohammed Rayyan
**Suggested Stack:** React + Next.js, Tailwind CSS, Shadcn UI, FastAPI, PostgreSQL, JWT/RBAC, WebSockets, Recharts

---

## 1. Roadmap Overview

| Phase | Duration | Focus |
|---|---|---|
| Phase 0 | Week 1 | Planning, architecture, DB design |
| Phase 1 | Weeks 2–3 | Core backend + Auth + RBAC |
| Phase 2 | Weeks 4–5 | Admin Panel (Hackathon, Rounds, Rubrics, Teams, Judges) |
| Phase 3 | Weeks 6–7 | Evaluator Dashboard + Scoring Engine |
| Phase 4 | Week 8 | Leaderboard + Analytics Dashboard |
| Phase 5 | Week 9 | Real-time features (WebSockets, Live Dashboard) |
| Phase 6 | Week 10 | Notifications, Reports (PDF/Excel export) |
| Phase 7 | Week 11 | Extra features: QR codes, anonymous judging, conflict detection, certificates |
| Phase 8 | Week 12 | Testing, deployment, documentation, demo prep |

Total estimated timeline: **12 weeks** (can compress to 6–8 weeks for hackathon MVP scope).

---

## 2. Phase 0 — Planning & Architecture (Week 1)

- Finalize feature scope for MVP vs. future release (use Modules 1–8 as MVP; QR/certificates/anonymous judging as stretch).
- Design entity-relationship diagram: Hackathon, Round, Rubric, Team, Member, Judge, Evaluation, Score, User.
- Define REST API contract (OpenAPI spec) for all modules.
- Set up repo structure (monorepo: `/frontend`, `/backend`), CI pipeline, linting, `.env` conventions.
- Choose hosting: Vercel (frontend), Render/Railway (backend), Neon/Supabase (Postgres).

**Deliverable:** ER diagram, API spec draft, repo scaffold.

---

## 3. Phase 1 — Core Backend, Auth & RBAC (Weeks 2–3)

- FastAPI project setup with modular routers (`/auth`, `/hackathons`, `/rounds`, `/rubrics`, `/teams`, `/judges`, `/evaluations`).
- PostgreSQL schema via SQLAlchemy/Alembic migrations.
- JWT-based authentication (access + refresh tokens).
- Role-Based Access Control: `Admin`, `Judge` roles with route guards/dependencies.
- Password hashing (bcrypt/argon2), login/logout endpoints.
- Seed script for test data (sample hackathon, teams, judges).

**Deliverable:** Working auth system; Admin/Judge can log in and receive role-scoped tokens.

---

## 4. Phase 2 — Admin Panel (Weeks 4–5)

**Hackathon Management**
- CRUD for hackathon (name, description, venue, date, banner, team size limits).

**Round Management**
- CRUD for rounds with start/end time, active/inactive toggle, judge assignment.

**Rubrics Management**
- Dynamic rubric builder per round (criteria name + max marks), stored as JSON or normalized table.
- Validation: rubric totals, per-round rubric sets.

**Team Management**
- Manual entry + bulk Excel/CSV import (use `pandas`/`openpyxl` on backend).
- Fields: Team ID, name, members, college, track, mentor, problem statement.

**Judge Management**
- Admin creates judge accounts, assigns rounds and teams.
- Judge dashboard preview (read-only from admin side).

**Frontend**
- Next.js admin routes with Shadcn UI forms/tables, protected by RBAC middleware.

**Deliverable:** Admin can fully configure a hackathon end-to-end through the UI.

---

## 5. Phase 3 — Evaluator Dashboard & Scoring Engine (Weeks 6–7)

- Judge login → dashboard showing current round + assigned teams.
- Evaluation form: dynamic rendering based on round's rubric, score inputs bound to max marks, comments field.
- "Save Draft" vs "Submit" states; lock scores post-submission unless admin unlocks.
- Backend scoring engine: aggregate scores per team per round, weighted totals if needed.
- Audit trail: log every score creation/edit with timestamp and judge ID.

**Deliverable:** Judges can evaluate assigned teams; scores persist and lock correctly.

---

## 6. Phase 4 — Leaderboard & Analytics (Week 8)

**Leaderboard**
- Auto-computed ranking: Overall, Round-wise, Track-wise, College-wise views.
- Tie-breaking logic: configurable rule order (e.g., Innovation score → Technical score → submission time), with manual override option for admin.

**Analytics Dashboard**
- Charts via Recharts: average score per judge, highest/lowest scoring teams, round-wise averages, judge completion %, pending evaluations, score distribution, heatmaps.
- Backend aggregation endpoints (SQL views or computed queries).

**Deliverable:** Real-time-ready leaderboard and organizer analytics dashboard.

---

## 7. Phase 5 — Real-Time Features (Week 9)

- Integrate WebSockets/Socket.IO for live leaderboard updates on score submission.
- Live Event Dashboard: teams evaluated count, pending count, countdown timer, current round indicator — designed for projector/big-screen display.
- Load-test concurrent judge submissions to confirm leaderboard consistency.

**Deliverable:** Live dashboard updates instantly as judges submit scores.

---

## 8. Phase 6 — Notifications & Reports (Week 10)

**Notifications**
- Admin: judge submitted scores, judge pending, round completed.
- Judge: evaluation assigned, reminder notifications.
- Implementation: in-app notification center; optional email via SMTP/SendGrid.

**Reports**
- PDF generation (e.g., `reportlab`/`weasyprint`) for: per-team report, per-judge report, overall hackathon report (winner, runner-up, analytics/charts).
- Export leaderboard/team data to Excel and CSV.

**Deliverable:** Downloadable reports and functioning notification system.

---

## 9. Phase 7 — Extra & Differentiator Features (Week 11)

- **QR Code check-in/evaluation:** generate per-team QR (e.g., `qrcode` lib); scanning opens evaluation page directly.
- **Anonymous judging mode:** toggle to mask team names (e.g., "Team A17") to reduce bias.
- **Conflict-of-interest detection:** flag/prevent a judge from evaluating a team linked to their own institution/students.
- **Attendance tracking:** check-in status (Present/Absent/Late) per team.
- **Auto-certificate generation:** templated PDF certificates for winners, participants, judges, mentors.

**Deliverable:** Feature-complete platform matching full spec.

---

## 10. Phase 8 — Testing, Deployment & Demo Prep (Week 12)

- Unit tests (backend: pytest; frontend: Jest/RTL) for scoring logic, RBAC, ranking/tie-break rules.
- End-to-end test of a mock hackathon: create event → assign judges → import teams → run 2 rounds → generate leaderboard → export reports.
- Security pass: input validation, rate limiting, JWT expiry handling.
- Deploy: frontend → Vercel, backend → Railway/Render, DB → Neon/Supabase.
- Write README, setup docs, and a short demo script/video for showcasing at club events or hackathon submissions.

**Deliverable:** Production-deployed, documented, demo-ready platform.

---

## 11. MVP Cut (If Time-Constrained, ~4–5 Weeks)

If building for a specific hackathon deadline, prioritize in this order:
1. Auth + RBAC (Admin/Judge)
2. Hackathon/Round/Rubric creation
3. Team import + Judge assignment
4. Evaluation form + scoring lock
5. Auto-generated leaderboard
6. Basic analytics (2–3 charts)
7. Excel/PDF export

Defer: QR codes, anonymous judging, conflict detection, certificates, live WebSocket dashboard, notifications — these become strong "Future Enhancements" talking points in a submission deck.

---

## 12. Suggested Team Split (If Working in a Group)

| Role | Responsibility |
|---|---|
| Backend Lead | FastAPI, DB schema, auth, scoring engine |
| Frontend Lead | Next.js admin panel, evaluator dashboard, Shadcn UI |
| Full-Stack/Integration | Real-time (WebSockets), analytics dashboard, reports |
| QA/DevOps | Testing, deployment, CI/CD, documentation |

---

## 13. Future Enhancements (Post-MVP)

- AI-assisted judging summaries generated from evaluator comments.
- AI flagging of inconsistent scoring across judges.
- Mobile-friendly Progressive Web App (PWA) for judges.
- Public results portal with filters.
- Multi-event support (club-wide hackathon management).
- Full audit logs for every score submission/modification.
