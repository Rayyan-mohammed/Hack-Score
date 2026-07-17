import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

// Entry point: send users to the right place based on auth + role.
export default async function Home() {
  const { user, profile } = await getSessionUser();

  if (!user) redirect("/login");
  if (profile?.role === "admin") redirect("/admin");
  redirect("/judge");
}
