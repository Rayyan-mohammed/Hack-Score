/** Shown only to an admin viewing a team's page before results are published. */
export function ResultsPreviewBanner() {
  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-center text-sm text-warning"
    >
      <strong>Admin preview.</strong> Results aren&apos;t published yet — the
      team can&apos;t open this page until you publish. This is exactly what
      they will see.
    </div>
  );
}
