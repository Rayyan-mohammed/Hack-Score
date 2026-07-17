"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Glassmorphic modal built on <dialog> — native focus trap, Esc handling and
 * top-layer stacking, so no extra dependency is needed.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself) dismisses.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
      className={cn(
        "m-auto w-[calc(100vw-2rem)] max-w-lg rounded-2xl p-0 text-foreground",
        "glass shadow-lift backdrop:glass-scrim",
        "open:animate-fade-in-up",
        className,
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="modal-title"
              className="font-display text-lg font-semibold tracking-tight"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-foreground"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {children && <div className="mt-4 text-sm">{children}</div>}
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </dialog>
  );
}
