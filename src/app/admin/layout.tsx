import { requireAdmin } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/hackathons", label: "Hackathons" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/send-emails", label: "Send Emails" },
  { href: "/admin/judges", label: "Judges" },
  { href: "/admin/leaderboard", label: "Leaderboard" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/trash", label: "Trash" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAdmin();
  return (
    <AppShell profile={profile} nav={nav}>
      {children}
    </AppShell>
  );
}
