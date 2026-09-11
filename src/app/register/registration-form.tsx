"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import {
  EMPTY_REGISTRATION,
  formatCountdown,
  validateRegistration,
  type RegistrationValues,
} from "@/lib/registration-form";
import {
  membersToSlots,
  parseMembers,
  slotsToMembers,
  validateTeamSize,
} from "@/lib/team-validation";
import type { ProblemStatement } from "@/lib/registrations";
import { autoSubmitDraft, saveDraft, submitRegistration } from "./actions";

/** Sentinel for "my problem statement isn't in the list". */
const OTHER = "__other";

/** Idle time after the last keystroke before the draft is saved. */
const AUTOSAVE_DEBOUNCE_MS = 1500;
/** Periodic flush, so an idle tab never holds more than this much unsaved work. */
const AUTOSAVE_INTERVAL_MS = 20_000;
/** Inside this window before the deadline, save on every change. */
const FINAL_FLUSH_MS = 20_000;

function CountdownBanner({
  remaining,
  saving,
  savedAt,
}: {
  remaining: number;
  saving: boolean;
  savedAt: number | null;
}) {
  // Under five minutes the banner turns amber — the same signal the judge
  // lock warning uses, so "time is running out" reads the same everywhere.
  const urgent = remaining < 5 * 60 * 1000;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 backdrop-blur ${
        urgent
          ? "border-warning/50 bg-warning/10"
          : "border-violet/40 bg-violet/10"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <svg
          viewBox="0 0 20 20"
          className={`h-5 w-5 shrink-0 ${urgent ? "text-warning" : "text-violet-bright"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="10" cy="11" r="7" />
          <path d="M10 7.5V11l2 1.5M7.5 2h5" />
        </svg>
        <p className="text-sm font-medium text-foreground">
          Draft saved — Auto-submission in{" "}
          <span
            className={`font-mono text-base font-semibold tabular-nums ${
              urgent ? "text-warning" : "text-violet-bright"
            }`}
          >
            {formatCountdown(remaining)}
          </span>
        </p>
      </div>
      <p className="text-xs text-muted">
        {saving
          ? "Saving…"
          : savedAt
            ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
            : "Changes save automatically"}
      </p>
    </div>
  );
}

export function RegistrationForm({
  hackathonId,
  problemStatements,
  minSize,
  maxSize,
  initialValues,
  initialToken,
  initialExpiresAt,
}: {
  hackathonId: string;
  problemStatements: ProblemStatement[];
  /** The hackathon's team-size bounds — the same rule admins get. */
  minSize: number;
  maxSize: number;
  initialValues?: RegistrationValues;
  initialToken?: string | null;
  initialExpiresAt?: string | null;
}) {
  const router = useRouter();

  const [values, setValues] = useState<RegistrationValues>(
    initialValues ?? EMPTY_REGISTRATION,
  );
  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(
    initialExpiresAt ?? null,
  );
  const [choice, setChoice] = useState<string>(() => {
    const code = initialValues?.problem_statement_code ?? "";
    if (!code) return "";
    return problemStatements.some((p) => p.ps_code === code) ? code : OTHER;
  });

  // The roster is typed one name per row ("Member 2" … "Member N"), but is
  // still stored as the semicolon string every other path expects. Slot
  // positions live here so clearing a middle row doesn't shuffle the ones
  // below it up.
  const memberSlots = Math.max(0, maxSize - 1);
  const [slots, setSlots] = useState<string[]>(() =>
    membersToSlots(initialValues?.members ?? "", memberSlots),
  );

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Set on the first successful save of this session; a resumed draft simply
  // shows "changes save automatically" until then.
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Latest values, readable from timers without re-arming them on every
  // keystroke. Written in an effect (never during render) so the refs stay a
  // side-channel for the autosave timers rather than something React renders.
  const valuesRef = useRef(values);
  const tokenRef = useRef(token);
  const dirtyRef = useRef(dirty);
  const inFlight = useRef(false);
  const finalising = useRef(false);

  useEffect(() => {
    valuesRef.current = values;
    tokenRef.current = token;
    dirtyRef.current = dirty;
  });

  const remaining = expiresAt
    ? new Date(expiresAt).getTime() - now
    : null;
  const expired = remaining !== null && remaining <= 0;

  /** Create or update the draft. Safe to call concurrently — extra calls no-op. */
  const persist = useCallback(async () => {
    if (inFlight.current || finalising.current) return null;
    inFlight.current = true;
    setSaving(true);
    try {
      const res = await saveDraft({
        hackathonId,
        token: tokenRef.current,
        values: valuesRef.current,
      });

      if (res.token) {
        setToken(res.token);
        // Put the draft link in the address bar without a server round trip, so
        // a reload (or a bookmark) comes back to this same draft.
        window.history.replaceState(
          null,
          "",
          `/register/${hackathonId}?draft=${res.token}`,
        );
      }
      if (res.expiresAt) setExpiresAt(res.expiresAt);

      if (res.locked && res.token) {
        router.replace(`/register/success/${res.token}`);
        return res;
      }
      if (res.ok) {
        setDirty(false);
        setSavedAt(Date.now());
        setError(null);
      } else if (res.error && res.error !== "Nothing to save yet.") {
        setError(res.error);
      }
      return res;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [hackathonId, router]);

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (!dirty || expired) return;
    const id = setTimeout(() => void persist(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [values, dirty, expired, persist]);

  // In the last seconds before the deadline, skip the debounce entirely — past
  // it the server refuses draft writes, so anything unsaved would be lost.
  useEffect(() => {
    if (!dirty || expired) return;
    if (remaining === null || remaining > FINAL_FLUSH_MS) return;
    void persist();
  }, [remaining, dirty, expired, persist]);

  // Belt-and-braces flush for a tab left open mid-form.
  useEffect(() => {
    const id = setInterval(() => {
      if (dirtyRef.current) void persist();
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [persist]);

  // Countdown tick.
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Deadline reached: hand the row to the auto-submit path and show the receipt.
  useEffect(() => {
    if (!expired || !token || finalising.current) return;
    finalising.current = true;
    void (async () => {
      const res = await autoSubmitDraft(token);
      if (res.ok) router.replace(`/register/success/${token}`);
      else {
        finalising.current = false;
        setError(res.error ?? "Could not submit your draft.");
      }
    })();
  }, [expired, token, router]);

  const setField = (key: keyof RegistrationValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
    setNotice(null);
  };

  /** One roster row changed — rewrite the stored members string from all rows. */
  const setMemberSlot = (index: number, value: string) => {
    const next = slots.slice();
    next[index] = value;
    setSlots(next);
    setField("members", slotsToMembers(next));
  };

  const onPickStatement = (code: string) => {
    setChoice(code);
    setNotice(null);
    setDirty(true);
    if (code === OTHER || code === "") {
      setValues((v) => ({
        ...v,
        problem_statement_code: code === OTHER ? v.problem_statement_code : "",
        problem_statement: code === OTHER ? v.problem_statement : "",
      }));
      return;
    }
    const picked = problemStatements.find((p) => p.ps_code === code);
    setValues((v) => ({
      ...v,
      problem_statement_code: code,
      problem_statement: picked?.title ?? "",
    }));
  };

  const onSaveDraft = async () => {
    const res = await persist();
    if (res?.ok) setNotice("Draft saved. You can come back to this link later.");
  };

  const onSubmit = async () => {
    setError(null);
    setNotice(null);

    const invalid = validateRegistration(values, { min: minSize, max: maxSize });
    if (invalid) {
      setError(invalid);
      return;
    }
    if (
      !confirm(
        "Submit your registration? You won't be able to edit it afterwards.",
      )
    )
      return;

    setSubmitting(true);
    try {
      const res = await submitRegistration({
        hackathonId,
        token: tokenRef.current,
        values: valuesRef.current,
      });
      if (res.ok && res.token) {
        finalising.current = true;
        router.replace(`/register/success/${res.token}`);
        return;
      }
      if (res.locked && res.token) {
        router.replace(`/register/success/${res.token}`);
        return;
      }
      setError(res.error ?? "Could not submit your registration.");
    } finally {
      setSubmitting(false);
    }
  };

  // Live team-size feedback: the leader (this registrant) plus listed members.
  const memberCount = parseMembers(values.members).length;
  const teamTotal = 1 + memberCount;
  const sizeError = validateTeamSize(memberCount, minSize, maxSize);
  const sizeOk = !sizeError;

  const busy = submitting || expired;
  const picked =
    choice && choice !== OTHER
      ? problemStatements.find((p) => p.ps_code === choice)
      : undefined;

  return (
    <div className="space-y-5">
      {remaining !== null && !expired && (
        <CountdownBanner
          remaining={remaining}
          saving={saving}
          savedAt={savedAt}
        />
      )}

      {expired && (
        <Toast
          tone="info"
          message="Your one-hour window has closed. Submitting your form…"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Not a <form action> — every field autosaves as a draft, and the
              final submit needs a confirmation step first. */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="full_name">Name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  autoComplete="name"
                  value={values.full_name}
                  disabled={busy}
                  onChange={(e) => setField("full_name", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sap_id">SAP ID</Label>
                <Input
                  id="sap_id"
                  name="sap_id"
                  inputMode="numeric"
                  placeholder="60012345678"
                  value={values.sap_id}
                  disabled={busy}
                  onChange={(e) => setField("sap_id", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="mobile">Mobile number</Label>
                <Input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9876543210"
                  value={values.mobile}
                  disabled={busy}
                  onChange={(e) => setField("mobile", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="college_email">College email ID</Label>
                <Input
                  id="college_email"
                  name="college_email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@college.edu"
                  value={values.college_email}
                  disabled={busy}
                  onChange={(e) => setField("college_email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <div>
                <Label htmlFor="team_name">Team name</Label>
                <Input
                  id="team_name"
                  name="team_name"
                  minLength={3}
                  placeholder="Byte Squad"
                  value={values.team_name}
                  disabled={busy}
                  onChange={(e) => setField("team_name", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor={memberSlots > 0 ? "member_2" : undefined}>
                  Team members
                </Label>
                <p className="mb-2.5 text-xs text-subtle">
                  One name per row. The first row is you — the team leader —
                  filled in from your name above.
                </p>

                <div className="space-y-2">
                  <div className="grid gap-1.5 sm:grid-cols-[9.5rem_1fr] sm:items-center sm:gap-3">
                    <span className="text-xs font-medium text-violet-bright">
                      Team Leader
                    </span>
                    <Input
                      readOnly
                      aria-label="Team leader"
                      value={values.full_name}
                      placeholder="Enter your name in “Name” above"
                      className="cursor-default"
                    />
                  </div>

                  {memberSlots === 0 ? (
                    <p className="text-xs text-muted">
                      This event is for solo participants — no extra members
                      needed.
                    </p>
                  ) : (
                    slots.map((value, i) => {
                      // Row i is person number i + 2 (the leader is person 1).
                      const person = i + 2;
                      const required = person <= minSize;
                      return (
                        <div
                          key={person}
                          className="grid gap-1.5 sm:grid-cols-[9.5rem_1fr] sm:items-center sm:gap-3"
                        >
                          <Label
                            htmlFor={`member_${person}`}
                            className="mb-0 text-xs font-medium text-muted"
                          >
                            Member {person}
                            {!required && (
                              <span className="text-subtle"> (optional)</span>
                            )}
                          </Label>
                          <Input
                            id={`member_${person}`}
                            value={value}
                            disabled={busy}
                            autoComplete="off"
                            placeholder="Full name"
                            required={required}
                            onChange={(e) => setMemberSlot(i, e.target.value)}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                <p
                  className={`mt-2.5 text-xs font-medium ${
                    sizeOk ? "text-success" : "text-danger"
                  }`}
                >
                  {sizeOk ? "✓ " : "✕ "}
                  Team size: {teamTotal} of {minSize}–{maxSize} members
                  {!sizeOk ? ` — ${sizeError}` : ""}
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ps_choice">Problem statement ID</Label>
                  {problemStatements.length > 0 ? (
                    <Select
                      id="ps_choice"
                      value={choice}
                      disabled={busy}
                      onChange={(e) => onPickStatement(e.target.value)}
                    >
                      <option value="">Select a problem statement ID…</option>
                      {problemStatements.map((p) => (
                        <option key={p.id} value={p.ps_code}>
                          {p.ps_code} — {p.title}
                        </option>
                      ))}
                      <option value={OTHER}>Other / not listed</option>
                    </Select>
                  ) : (
                    <Input
                      id="ps_choice"
                      placeholder="PS-001"
                      value={values.problem_statement_code}
                      disabled={busy}
                      onChange={(e) =>
                        setField("problem_statement_code", e.target.value)
                      }
                      required
                    />
                  )}
                  {choice === OTHER && (
                    <Input
                      aria-label="Problem statement ID"
                      className="mt-2"
                      placeholder="PS-001"
                      value={values.problem_statement_code}
                      disabled={busy}
                      onChange={(e) =>
                        setField("problem_statement_code", e.target.value)
                      }
                      required
                    />
                  )}
                </div>
                <div className="sm:pt-7">
                  {picked ? (
                    <p className="text-xs text-muted">
                      Selecting an ID fills in the problem statement below.
                    </p>
                  ) : (
                    <p className="text-xs text-muted">
                      {problemStatements.length > 0
                        ? "Pick your ID from the list, or choose “Other” to type your own."
                        : "Enter the ID given to you by the organisers."}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <Label htmlFor="problem_statement">Problem statement</Label>
                <Textarea
                  id="problem_statement"
                  name="problem_statement"
                  value={values.problem_statement}
                  disabled={busy}
                  readOnly={Boolean(picked)}
                  onChange={(e) => setField("problem_statement", e.target.value)}
                  placeholder="AI-Based Healthcare Assistant"
                  required
                />
                {picked?.description && (
                  <p className="mt-1.5 text-xs text-muted">
                    {picked.description}
                  </p>
                )}
                {picked && (
                  <p className="mt-1.5 text-xs text-subtle">
                    Filled in from {picked.ps_code}. Choose “Other / not listed”
                    to write your own.
                  </p>
                )}
              </div>
            </div>

            <Toast tone="error" message={error} />
            <Toast tone="success" message={notice} />

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                disabled={busy || saving}
                onClick={() => void onSaveDraft()}
              >
                {saving ? "Saving…" : "Save draft"}
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void onSubmit()}
              >
                {submitting ? "Submitting…" : "Submit"}
              </Button>
              <p className="text-xs text-muted sm:ml-auto">
                Submitting is final — you can&apos;t edit afterwards.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
