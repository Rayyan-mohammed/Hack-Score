// Number formatting shared by the report builder (server) and the PDF/Excel
// writers (client). Pure module — no server imports, safe to bundle.

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 2 decimals, without the trailing ".00" on whole numbers. */
export function fmt(n: number): string {
  const r = round2(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

/** Marks-out-of, e.g. "42.5 / 50". */
export function outOf(score: number, max: number): string {
  return `${fmt(score)} / ${fmt(max)}`;
}
