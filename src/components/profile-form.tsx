"use client";
import { useActionState } from "react";
import { updateProfile } from "@/app/account/actions";
import type { Profile } from "@/domain/models";
import { initialFormResult } from "@/domain/auth";
import { FormFeedback } from "./auth-forms";
import { Button, Input } from "./ui";
export function ProfileForm({ profile }: { profile: Profile }) {
  const [result, action, pending] = useActionState(
    updateProfile,
    initialFormResult,
  );
  return (
    <form action={action} className="stack-form">
      <fieldset
        disabled={pending}
        className="form-fields"
        key={profile.updatedAt}
      >
        <label className="field-label" htmlFor="profile-name">
          Display name
          <Input
            id="profile-name"
            name="displayName"
            defaultValue={profile.displayName}
            required
            maxLength={120}
            autoComplete="nickname"
          />
        </label>
        <label className="field-label" htmlFor="postcode">
          Postcode (optional)
          <Input
            id="postcode"
            name="postcode"
            defaultValue={profile.postcode ?? ""}
            maxLength={12}
            autoComplete="postal-code"
          />
        </label>
        <Button type="submit">{pending ? "Saving…" : "Save profile"}</Button>
      </fieldset>
      <FormFeedback result={result} />
    </form>
  );
}
