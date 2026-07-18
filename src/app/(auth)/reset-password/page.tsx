"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [ready, setReady] = React.useState<"checking" | "ok" | "invalid">(
    "checking",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // The recovery link establishes a session (the browser client processes the
  // token in the URL on load). Confirm one exists before showing the form.
  React.useEffect(() => {
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        done = true;
        setReady("ok");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!done) setReady(data.session ? "ok" : "invalid");
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setError(error.message);
    router.push("/");
  }

  if (ready === "checking") {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted">Verifying your reset link…</p>
        </CardContent>
      </Card>
    );
  }

  if (ready === "invalid") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            This reset link is invalid or has expired. Request a new one.
          </p>
          <Link href="/forgot-password">
            <Button className="w-full">Request a new link</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <Toast tone="error" message={error} />
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
