"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import type { ReportConfig, Signatory } from "@/lib/report-config";
import type { ReportBundle } from "@/lib/report-data";
import { saveReportConfig, type FormState } from "./actions";
import { generateReportPdf } from "./report-pdf";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save details"}
    </Button>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function SignatoryFields({
  prefix,
  title,
  value,
  onChange,
}: {
  prefix: "preparedBy" | "verifiedBy" | "approvedBy";
  title: string;
  value: Signatory;
  onChange: (next: Signatory) => void;
}) {
  const set = (key: keyof Signatory) => (v: string) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="rounded-xl border border-border bg-surface-raised/40 p-4">
      <p className="mb-3 font-display text-sm font-semibold text-foreground">
        {title}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={`${prefix}_name`}
          label="Name"
          value={value.name}
          onChange={set("name")}
        />
        <Field
          id={`${prefix}_designation`}
          label="Designation"
          value={value.designation}
          onChange={set("designation")}
        />
        <Field
          id={`${prefix}_department`}
          label="Department"
          value={value.department}
          onChange={set("department")}
        />
        <Field
          id={`${prefix}_institution`}
          label="Institution"
          value={value.institution}
          onChange={set("institution")}
        />
      </div>
      <p className="mt-2 text-xs text-subtle">
        Blank fields print as a ruled line for a handwritten entry.
      </p>
    </div>
  );
}

/**
 * Pre-report configuration: institution letterhead, report particulars and the
 * signature block, followed by the two generate actions.
 *
 * The PDF is built in the browser from the bundle plus whatever is currently in
 * this form; the Excel workbook is built on the server from the *saved* config,
 * so unsaved edits are called out rather than silently diverging.
 */
export function ReportWorkspace({ bundle }: { bundle: ReportBundle }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveReportConfig,
    {},
  );
  const [config, setConfig] = useState<ReportConfig>(bundle.config);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A successful save means the form and the stored config agree again.
  // Tracked during render rather than in an effect, so the banner never shows
  // a stale "unsaved changes" for a frame.
  const [savedMessage, setSavedMessage] = useState(state.message);
  if (state.message !== savedMessage) {
    setSavedMessage(state.message);
    if (state.message) setDirty(false);
  }

  const set =
    <K extends keyof ReportConfig>(key: K) =>
    (value: ReportConfig[K]) => {
      setConfig((c) => ({ ...c, [key]: value }));
      setDirty(true);
    };

  // Optional details are omitted from the report rather than printed as "—",
  // so say plainly which ones are still blank.
  const missing = [
    !config.academicYear.trim() && "academic year",
    !config.refNumber.trim() && "reference number",
    !config.address.trim() && "address",
    !config.preparedBy.name.trim() && "prepared by",
    !config.verifiedBy.name.trim() && "verified by",
    !config.approvedBy.name.trim() && "approved by / HOD",
  ].filter(Boolean) as string[];

  const onGeneratePdf = async () => {
    setError(null);
    setBusy(true);
    try {
      await generateReportPdf({ ...bundle, config });
    } catch (e) {
      setError(
        e instanceof Error ? `Could not build the PDF: ${e.message}` : "Could not build the PDF.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Report details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <input
              type="hidden"
              name="hackathon_id"
              value={bundle.hackathon.id}
            />

            <div>
              <p className="mb-3 font-display text-sm font-semibold text-foreground">
                Institution
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  id="institution"
                  label="Institution name"
                  value={config.institution}
                  onChange={set("institution")}
                />
                <Field
                  id="department"
                  label="Department"
                  value={config.department}
                  onChange={set("department")}
                />
                <Field
                  id="academicYear"
                  label="Academic year"
                  placeholder="2026–27"
                  value={config.academicYear}
                  onChange={set("academicYear")}
                />
                <Field
                  id="logoUrl"
                  label="Logo URL"
                  value={config.logoUrl}
                  onChange={set("logoUrl")}
                  hint="Same-origin path (e.g. /logo.png) or a full URL. Left blank, the report prints without a logo."
                />
              </div>
              <div className="mt-3">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  name="address"
                  value={config.address}
                  onChange={(e) => set("address")(e.target.value)}
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 font-display text-sm font-semibold text-foreground">
                Report
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  id="reportTitle"
                  label="Report title"
                  value={config.reportTitle}
                  onChange={set("reportTitle")}
                />
                <Field
                  id="examName"
                  label="Examination / event"
                  placeholder={bundle.hackathon.name}
                  value={config.examName}
                  onChange={set("examName")}
                />
                <Field
                  id="reportDate"
                  label="Report date"
                  type="date"
                  value={config.reportDate}
                  onChange={set("reportDate")}
                />
                <Field
                  id="refNumber"
                  label="Reference number"
                  placeholder="STME/CE/2026/014"
                  value={config.refNumber}
                  onChange={set("refNumber")}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <p className="font-display text-sm font-semibold text-foreground">
                Signatories
              </p>
              <SignatoryFields
                prefix="preparedBy"
                title="Prepared by"
                value={config.preparedBy}
                onChange={set("preparedBy")}
              />
              <SignatoryFields
                prefix="verifiedBy"
                title="Verified by"
                value={config.verifiedBy}
                onChange={set("verifiedBy")}
              />
              <SignatoryFields
                prefix="approvedBy"
                title="Approved by / Head of Department"
                value={config.approvedBy}
                onChange={set("approvedBy")}
              />
            </div>

            <Toast tone="error" message={state.error} />
            <Toast tone="success" message={state.message} />
            <SaveButton />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Both files contain all three levels — overall summary, round-wise
            distribution and the full evaluator / team / component audit trail —
            built from the same evaluation data as the preview below.
          </p>

          {missing.length > 0 && (
            <Toast
              tone="info"
              message={`Not filled in yet: ${missing.join(", ")}. Blank details are left off the report rather than printed empty — fill them in if officials expect them.`}
            />
          )}

          {bundle.discrepancies.length > 0 && (
            <Toast
              tone="error"
              message={`${bundle.discrepancies.length} reconciliation problem(s) were found. The report will print them on its first page — resolve them before treating it as final.`}
            />
          )}

          {dirty && (
            <Toast
              tone="info"
              message="You have unsaved changes. The PDF uses what is on screen; the Excel workbook uses the saved values — save first to keep them identical."
            />
          )}

          <Toast tone="error" message={error} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void onGeneratePdf()}
            >
              {busy ? "Building PDF…" : "Generate PDF"}
            </Button>
            <a
              href={`/admin/leaderboard/report/excel?h=${bundle.hackathon.id}`}
            >
              <Button type="button" variant="outline" className="w-full">
                Download Excel
              </Button>
            </a>
            <a
              href={`/admin/leaderboard/report/word?h=${bundle.hackathon.id}`}
            >
              <Button type="button" variant="outline" className="w-full">
                Download Word
              </Button>
            </a>
            <a href="#report-preview" className="sm:ml-auto">
              <Button type="button" variant="ghost" className="w-full">
                Preview report ↓
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
