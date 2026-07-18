"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";
import type { NavItem } from "@/components/app-shell";

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === pathname || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

/** Sidebar nav links with an animated gradient underline + active state. */
export function NavLinks({
  nav,
  onNavigate,
}: {
  nav: NavItem[];
  onNavigate?: () => void;
}) {
  const isActive = useIsActive();

  return (
    <>
      {nav.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            data-active={active}
            className={cn(
              "nav-underline block rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200",
              active
                ? "bg-gradient-accent-soft text-foreground"
                : "text-muted hover:bg-surface-raised hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/** Hamburger + slide-in drawer. Replaces the sidebar below the md breakpoint. */
export function MobileNav({
  nav,
  footer,
}: {
  nav: NavItem[];
  footer?: React.ReactNode;
}) {
  // Link clicks close the drawer via NavLinks' onNavigate, so no route effect is needed.
  const [open, setOpen] = React.useState(false);

  // Esc to dismiss, and lock body scroll while the drawer is open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-strong text-muted transition-colors duration-150 hover:border-violet/60 hover:text-foreground"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
      </button>

      {/* The drawer is portalled to <body>. The header uses backdrop-blur, which
          creates a containing block for fixed-position descendants — rendering
          the drawer here would clip it to the header's height. Portalling out
          restores true viewport-fixed positioning. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex md:hidden">
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="glass-scrim absolute inset-0 cursor-default"
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="glass relative flex h-full w-72 max-w-[85vw] animate-fade-in-up flex-col border-r border-border shadow-lift"
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <Brand />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded-lg p-1.5 text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-foreground"
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
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                <NavLinks nav={nav} onNavigate={() => setOpen(false)} />
              </nav>
              {footer && (
                <div className="border-t border-border p-3">{footer}</div>
              )}
            </aside>
          </div>,
          document.body,
        )}
    </div>
  );
}
