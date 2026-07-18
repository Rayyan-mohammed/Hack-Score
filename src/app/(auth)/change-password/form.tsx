"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { changePassword, type PwState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Set new password"}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<PwState, FormData>(
    changePassword,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Your account uses a temporary password. Choose a new one to continue.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
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
          <Toast tone="error" message={state.error} />
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
