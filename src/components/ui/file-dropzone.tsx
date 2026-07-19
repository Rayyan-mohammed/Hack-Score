"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop file picker that submits with a normal <form>.
 *
 * A real (visually hidden) <input type="file" name=...> stays in the form so
 * submission is unchanged; drops are written into it via a DataTransfer. The
 * zone validates type/size client-side and shows a preview, but the server
 * remains the source of truth.
 */
export function FileDropzone({
  name,
  accept = ".csv",
  maxSizeMB = 10,
  hint = "CSV file, up to 10MB",
  disabled = false,
}: {
  name: string;
  accept?: string;
  maxSizeMB?: number;
  hint?: string;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const maxBytes = maxSizeMB * 1024 * 1024;

  const validate = React.useCallback(
    (f: File): string | null => {
      const isCsv =
        /\.csv$/i.test(f.name) ||
        f.type === "text/csv" ||
        f.type === "application/vnd.ms-excel";
      if (!isCsv) return "Only .csv files are supported.";
      if (f.size > maxBytes) return `File is too large (max ${maxSizeMB}MB).`;
      if (f.size === 0) return "That file looks empty.";
      return null;
    },
    [maxBytes, maxSizeMB],
  );

  const accept_file = React.useCallback(
    (f: File | undefined | null) => {
      if (!f) return;
      const err = validate(f);
      if (err) {
        setError(err);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      setError(null);
      setFile(f);
      // Mirror the chosen/dropped file into the real input so the form submits it.
      const dt = new DataTransfer();
      dt.items.add(f);
      if (inputRef.current) inputRef.current.files = dt.files;
    },
    [validate],
  );

  const clear = () => {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const open = () => !disabled && inputRef.current?.click();

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        className="sr-only"
        onChange={(e) => accept_file(e.target.files?.[0])}
        tabIndex={-1}
        aria-hidden="true"
      />

      {!file ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label="Upload a CSV file"
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled) accept_file(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200",
            "bg-gradient-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright",
            dragging
              ? "scale-[1.01] border-violet bg-violet/15 shadow-glow-violet"
              : "border-border-strong hover:border-violet/60 hover:shadow-glow-soft",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border border-border-strong bg-surface text-violet-bright transition-transform duration-200",
              dragging && "-translate-y-0.5",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 15V4M12 4 8 8M12 4l4 4" />
              <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {dragging ? "Drop your file to upload" : "Drag & drop your CSV here"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              or{" "}
              <span className="font-medium text-violet-bright">
                click to browse
              </span>{" "}
              · {hint}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/10 px-4 py-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="10" cy="10" r="7.5" strokeWidth="1.5" />
              <path d="m6.5 10 2.25 2.25L14 7.5" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {file.name}
            </p>
            <p className="text-xs text-muted">
              {humanSize(file.size)} · Ready to import
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={open}
              disabled={disabled}
              className="rounded-lg px-2 py-1 text-xs font-medium text-violet-bright transition-colors hover:text-cyan-bright disabled:opacity-50"
            >
              Change
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              aria-label="Remove file"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-raised hover:text-danger disabled:opacity-50"
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
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 flex items-center gap-1.5 text-xs text-danger"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.5" strokeWidth="1.5" />
            <path d="M8 5v3.5M8 11h.01" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
