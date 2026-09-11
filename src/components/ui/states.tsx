import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/** Empty state — muted glyph, a clear line of copy, and an optional action. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border-strong bg-gradient-accent-soft">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-violet-bright"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
          <path d="m3 12 9 4.5L21 12M3 16.5 12 21l9-4.5" />
        </svg>
      </div>
      <p className="font-display text-base font-semibold text-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Empty state wrapped in a card — the common case for a page-level blank slate. */
export function EmptyCard(props: React.ComponentProps<typeof EmptyState>) {
  return (
    <Card>
      <EmptyState {...props} />
    </Card>
  );
}

/** Shimmering skeleton block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-xl bg-[length:200%_100%]",
        "bg-[linear-gradient(90deg,var(--color-surface)_25%,var(--color-surface-raised)_50%,var(--color-surface)_75%)]",
        className,
      )}
    />
  );
}

/**
 * Route-level loading screen, shown the instant a nav link is clicked while
 * the page itself is fetched. Shaped like a real page — title, a stat row,
 * a card of rows — so the swap to real content doesn't jump. Fades in after a
 * short delay: a page that arrives quickly never flashes a skeleton at all.
 */
export function PageSkeleton({
  label = "Loading page…",
  stats = true,
  rows = 5,
}: {
  label?: string;
  stats?: boolean;
  rows?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-skeleton-in space-y-6"
    >
      <span className="sr-only">{label}</span>

      <div className="space-y-2.5">
        <Skeleton className="h-8 w-48 sm:h-9" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <Skeleton className="h-5 w-32" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-12 shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 shrink-0 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Page-level loading placeholder: a stat row plus a table-ish block. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
