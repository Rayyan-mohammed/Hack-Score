"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(login, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <p className="mt-1 text-sm text-muted">Sign in to your account.</p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoFocus />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Toast tone="error" message={state.error} />
          <SubmitButton />
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
