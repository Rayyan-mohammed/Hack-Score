import { requireJudge } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/app-shell";

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
      {children}
    </AppShell>
  );
}
