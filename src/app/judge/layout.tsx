import { requireJudge } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";

const nav: NavItem[] = [
  { href: "/judge", label: "My Evaluations" },
];

export default async function JudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireJudge();
  return (
    <AppShell profile={profile} nav={nav}>
      {/* Picks up team edits an organiser makes while a judge has the page
          open, without them needing to reload. */}
      <AutoRefresh />
      {children}
    </AppShell>
  );
}
