import { isoDateInEventZone } from "@/lib/datetime";
// Institution / letterhead / signatory settings for the official evaluation
// report. Stored per hackathon in `hackathons.report_config` (jsonb) and used
// identically by the on-screen preview, the PDF and the Excel workbook.
//
// Pure module — safe to import from client components.

export type Signatory = {
  name: string;
  designation: string;
  department: string;
  institution: string;
};

export type ReportConfig = {
  institution: string;
  department: string;
  address: string;
  logoUrl: string;
  academicYear: string;
  reportTitle: string;
  examName: string;
  reportDate: string;
  refNumber: string;
  preparedBy: Signatory;
  verifiedBy: Signatory;
  approvedBy: Signatory;
};

const EMPTY_SIGNATORY: Signatory = {
  name: "",
  designation: "",
  department: "",
  institution: "",
};

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  institution: "NMIMS School of Technology Management & Engineering",
  department: "Department of Computer Engineering",
  address: "",
  logoUrl: "/logo.png",
  academicYear: "",
  reportTitle: "Official Results & Evaluation Report",
  examName: "",
  reportDate: "",
  refNumber: "",
  preparedBy: { ...EMPTY_SIGNATORY },
  verifiedBy: { ...EMPTY_SIGNATORY },
  approvedBy: { ...EMPTY_SIGNATORY, designation: "Head of Department" },
};

const SIGNATORY_KEYS = ["preparedBy", "verifiedBy", "approvedBy"] as const;

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function signatory(value: unknown, fallback: Signatory): Signatory {
  const v = (value ?? {}) as Partial<Signatory>;
  return {
    name: str(v.name, fallback.name),
    designation: str(v.designation, fallback.designation),
    department: str(v.department, fallback.department),
    institution: str(v.institution, fallback.institution),
  };
}

/**
 * Merge a stored (possibly empty or partial) config over the defaults, so
 * every consumer can rely on all keys being present.
 */
export function normaliseReportConfig(raw: unknown): ReportConfig {
  const v = (raw ?? {}) as Partial<ReportConfig>;
  const out: ReportConfig = {
    institution: str(v.institution, DEFAULT_REPORT_CONFIG.institution),
    department: str(v.department, DEFAULT_REPORT_CONFIG.department),
    address: str(v.address, DEFAULT_REPORT_CONFIG.address),
    logoUrl: str(v.logoUrl, DEFAULT_REPORT_CONFIG.logoUrl),
    academicYear: str(v.academicYear, DEFAULT_REPORT_CONFIG.academicYear),
    reportTitle: str(v.reportTitle, DEFAULT_REPORT_CONFIG.reportTitle),
    examName: str(v.examName, DEFAULT_REPORT_CONFIG.examName),
    reportDate: str(v.reportDate, DEFAULT_REPORT_CONFIG.reportDate),
    refNumber: str(v.refNumber, DEFAULT_REPORT_CONFIG.refNumber),
    preparedBy: signatory(v.preparedBy, DEFAULT_REPORT_CONFIG.preparedBy),
    verifiedBy: signatory(v.verifiedBy, DEFAULT_REPORT_CONFIG.verifiedBy),
    approvedBy: signatory(v.approvedBy, DEFAULT_REPORT_CONFIG.approvedBy),
  };
  return out;
}

/** Read a config out of a submitted form (used by the settings action). */
export function readReportConfigForm(get: (key: string) => string): ReportConfig {
  const base: Record<string, unknown> = {
    institution: get("institution"),
    department: get("department"),
    address: get("address"),
    logoUrl: get("logoUrl"),
    academicYear: get("academicYear"),
    reportTitle: get("reportTitle"),
    examName: get("examName"),
    reportDate: get("reportDate"),
    refNumber: get("refNumber"),
  };
  for (const key of SIGNATORY_KEYS) {
    base[key] = {
      name: get(`${key}_name`),
      designation: get(`${key}_designation`),
      department: get(`${key}_department`),
      institution: get(`${key}_institution`),
    };
  }
  return normaliseReportConfig(base);
}

/** "Official_Evaluation_Report_CodeIT_2026-09-09" (no extension). */
export function reportFileBase(

  config: ReportConfig,
  hackathonName: string,
): string {
  const event = config.examName || hackathonName || "Report";
  const date = (config.reportDate || isoDateInEventZone()).slice(0, 10);
  const slug = (s: string) =>
    s
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60);
  return `Official_Evaluation_Report_${slug(event)}_${date}`;
}
