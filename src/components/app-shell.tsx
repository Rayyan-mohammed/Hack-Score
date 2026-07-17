import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth";

export type NavItem = { href: string; label: string };

export function AppShell({
  profile,
  nav,
  children,
}: {
  profile: Profile | null;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const roleLabel = profile?.role === "admin" ? "Admin" : "Judge";

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            HS
          </span>
          <span className="font-semibold">HackScore</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate px-2 text-sm font-medium">
            {profile?.full_name || profile?.email}
          </p>
          <p className="px-2 text-xs text-muted">{roleLabel}</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="no-print flex h-14 items-center justify-between border-b border-border bg-card px-6">
          <span className="text-sm font-medium text-muted md:hidden">
            HackScore
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted">
              {profile?.email} · {roleLabel}
            </span>
            <form action={logout}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
