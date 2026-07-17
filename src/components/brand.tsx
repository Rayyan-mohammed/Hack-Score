import { cn } from "@/lib/utils";

/** HackScore wordmark + gradient monogram. Shared by the shell and auth screens. */
export function Brand({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-lg bg-gradient-accent font-display font-bold text-white shadow-glow-soft",
          size === "lg" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs",
        )}
      >
        HS
      </span>
      <span
        className={cn(
          "font-display font-semibold tracking-tight text-foreground",
          size === "lg" ? "text-lg" : "text-base",
        )}
      >
        Hack<span className="text-gradient-accent">Score</span>
      </span>
    </span>
  );
}
