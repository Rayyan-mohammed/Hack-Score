"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestReset, type ForgotState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState<ForgotState, FormData>(
    requestReset,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Enter your email and we&apos;ll send a link to set a new password.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoFocus />
          </div>
          <Toast tone="error" message={state.error} />
          <Toast tone="success" message={state.message} />
          <SubmitButton />
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          <Link
            href="/login"
            className="font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
          >
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
