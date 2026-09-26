"use server";
import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/server";
import { createUserDataRepository } from "@/providers/supabase/user-data";
import type { FormResult } from "@/domain/auth";
export async function updateProfile(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const displayName = String(form.get("displayName") ?? "").trim();
  const postcode = String(form.get("postcode") ?? "")
    .trim()
    .toUpperCase();
  if (!displayName || displayName.length > 120 || postcode.length > 12)
    return {
      status: "error",
      message:
        "Enter a name of 1–120 characters and a postcode of no more than 12 characters.",
    };
  try {
    await createUserDataRepository(await createSessionClient()).updateProfile({
      displayName,
      postcode: postcode || null,
    });
  } catch {
    return {
      status: "error",
      message:
        "We couldn’t save your profile. Check you’re signed in and try again.",
    };
  }
  revalidatePath("/account");
  return { status: "success", message: "Profile saved." };
}
