import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-xl border border-border-strong bg-surface-raised px-3 text-sm text-foreground placeholder:text-subtle " +
  "transition-[border-color,box-shadow] duration-200 ease-out " +
  "hover:border-violet/40 " +
  "focus-visible:border-violet focus-visible:shadow-glow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(field, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(field, "min-h-20 py-2", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(field, "h-10 pr-8", className)} {...props} />
));
Select.displayName = "Select";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("mb-1.5 block text-sm font-medium text-foreground", className)}
    {...props}
  />
));
Label.displayName = "Label";
