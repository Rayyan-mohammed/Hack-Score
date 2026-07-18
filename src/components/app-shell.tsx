import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { Footer } from "@/components/footer";
import { MobileNav, NavLinks } from "@/components/nav";
import type { Profile } from "@/lib/auth";

export type NavItem = { href: string; label: string };

function UserCard({ profile }: { profile: Profile | null }) {
  const roleLabel = profile?.role === "admin" ? "Admin" : "Judge";
  return (
    <div className="rounded-xl border border-border bg-surface-raised px-3 py-2">
      <p className="truncate text-sm font-medium text-foreground">
        {profile?.full_name || profile?.email}
      </p>
      <p className="mt-0.5 font-display text-xs font-medium tracking-wide text-violet-bright uppercase">
        {roleLabel}
      </p>
    </div>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={logout} className={className}>
      <Button variant="outline" size="sm" type="submit" className="w-full">
        Sign out
      </Button>
    </form>
  );
}

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

  // Everything the mobile drawer needs at its foot: identity + sign out.
  const drawerFooter = (
    <div className="space-y-3">
      <UserCard profile={profile} />
      <SignOutButton />
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1">
        {/* Sidebar — collapses into the drawer below md */}
        <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
          <div className="flex h-16 items-center border-b border-border px-5">
            <Brand />
          </div>
          <nav className="flex-1 space-y-1 p-3">
            <NavLinks nav={nav} />
          </nav>
          <div className="p-3">
            <UserCard profile={profile} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
            {/* Brand on the left (mobile only — the sidebar carries it on desktop) */}
            <span className="md:hidden">
              <Brand />
            </span>

            <div className="ml-auto flex items-center gap-3">
              {/* Desktop: identity + sign out on the right */}
              <span className="hidden text-sm text-muted md:inline">
                {profile?.email} · {roleLabel}
              </span>
              <SignOutButton className="hidden md:block" />

              {/* Mobile: hamburger on the right, opening the drawer */}
              <MobileNav nav={nav} footer={drawerFooter} />
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
