import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "./form";

export default async function ChangePasswordPage() {
  // Must be signed in; this is where the forced-change gate lands judges.
  await requireUser();
  return <ChangePasswordForm />;
}
