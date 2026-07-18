import * as React from "react";
import { cn } from "@/lib/utils";

// `danger` is kept as the original name; `destructive` is an alias so both work.
type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "destructive";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // Accent gradient + violet glow that intensifies on hover.
  primary:
    "bg-gradient-accent text-white shadow-glow-soft hover:shadow-glow-violet hover:brightness-110 active:brightness-95",
  // Tinted glass fill — quieter than primary, louder than outline.
  secondary:
    "bg-gradient-accent-soft text-foreground border border-violet/30 hover:border-violet/60 hover:shadow-glow-soft",
  outline:
    "border border-border-strong bg-surface text-foreground hover:border-violet/60 hover:bg-surface-raised hover:shadow-glow-soft",
  ghost: "text-muted hover:bg-surface-raised hover:text-foreground",
  danger:
    "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25 hover:border-danger/70 hover:shadow-glow-danger",
  destructive:
    "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25 hover:border-danger/70 hover:shadow-glow-danger",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  // 44px tap target on mobile (per WCAG/touch guidance), denser on desktop.
  md: "h-11 px-4 text-sm sm:h-10",
  lg: "h-11 px-6 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
