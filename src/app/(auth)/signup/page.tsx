"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signup, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(signup, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <p className="mt-1 text-sm text-muted">
          New accounts start as judges. An admin can promote you.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" type="text" autoFocus />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Toast tone="error" message={state.error} />
          <Toast tone="success" message={state.message} />
          <SubmitButton />
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
