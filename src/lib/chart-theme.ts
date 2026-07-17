/**
 * Chart tokens.
 *
 * Recharts renders raw SVG and cannot read Tailwind classes or resolve `var()`
 * inside presentation attributes, so chart colours have to be literal values.
 * This module is the single place they live — it mirrors the @theme tokens in
 * globals.css. Keep the two in sync; never inline hexes in a chart component.
 */
export const chart = {
  grid: "#232936", // --color-border
  axis: "#9ba6bc", // --color-muted
  surface: "#171c27", // --color-surface-raised
  border: "#2e3646", // --color-border-strong
  foreground: "#e8ecf4", // --color-foreground
  cursor: "rgba(124, 58, 237, 0.12)", // violet wash
  /** Accent gradient stops: electric violet -> cyan */
  gradientFrom: "#7c3aed", // --color-violet
  gradientTo: "#06b6d4", // --color-cyan
  /** Categorical series colours, ordered for maximum separation on dark. */
  series: ["#7c3aed", "#06b6d4", "#f472b6", "#fb923c", "#34d399"],
} as const;

/** Shared Recharts tooltip styling. */
export const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${chart.border}`,
  backgroundColor: chart.surface,
  color: chart.foreground,
  boxShadow: "0 8px 30px -6px rgba(0,0,0,0.6)",
  fontSize: 12,
} as const;
