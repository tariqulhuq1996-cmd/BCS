"use client";

import { useActionState } from "react";
import { changePassword, updateProfile } from "@/lib/auth/profile-actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/ui";

export function ProfileForm({ initial }: { initial: { name: string; phone: string; dailyGoalMin: string } }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const v = state?.values ?? initial;
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage text={state?.message} ok={state?.ok} />
      <Field name="name" label="পুরো নাম" autoComplete="name" defaultValue={v.name} errors={state?.errors?.name} />
      <Field name="phone" label="মোবাইল নম্বর (ঐচ্ছিক)" type="tel" autoComplete="tel" defaultValue={v.phone} errors={state?.errors?.phone} required={false} />
      <Field name="dailyGoalMin" label="প্রতিদিন পড়ার লক্ষ্য (মিনিট)" type="number" defaultValue={v.dailyGoalMin} errors={state?.errors?.dailyGoalMin} />
      <SubmitButton pending={pending} pendingText="সংরক্ষণ হচ্ছে…">প্রোফাইল সংরক্ষণ করুন</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate key={state?.ok ? "done" : "form"}>
      <FormMessage text={state?.message} ok={state?.ok} />
      <Field name="current" label="বর্তমান পাসওয়ার্ড" type="password" autoComplete="current-password" errors={state?.errors?.current} />
      <Field name="password" label="নতুন পাসওয়ার্ড" type="password" autoComplete="new-password" errors={state?.errors?.password} hint="অন্তত ৮ অক্ষর, একটি ইংরেজি বর্ণ ও একটি সংখ্যাসহ।" />
      <Field name="confirm" label="নতুন পাসওয়ার্ড আবার লিখুন" type="password" autoComplete="new-password" errors={state?.errors?.confirm} />
      <SubmitButton pending={pending} pendingText="বদলানো হচ্ছে…">পাসওয়ার্ড বদলান</SubmitButton>
    </form>
  );
}
