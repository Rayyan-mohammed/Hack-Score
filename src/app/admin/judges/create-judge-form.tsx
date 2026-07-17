"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { createJudge, type FormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Creating…" : "Create judge"}
    </Button>
  );
}

export function CreateJudgeForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createJudge,
    {},
  );
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" name="full_name" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="password">Temp password</Label>
          <Input id="password" name="password" type="text" required />
        </div>
      </div>
      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />
      <SubmitButton />
    </form>
  );
}
