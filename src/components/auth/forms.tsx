"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, register, requestPasswordReset, resetPassword } from "@/lib/auth/actions";
import { FormMessage, SubmitButton } from "./ui";
import { Field, RequiredNote, useErrorFocus } from "./field";

function useNext() {
  const n = useSearchParams().get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export function RegisterForm() {
  const next = useNext();
  const [state, action, pending] = useActionState(register, undefined);
  const formRef = useErrorFocus(state);
  return (
    <form ref={formRef} action={action} className="grid gap-5" noValidate>
      <RequiredNote />
      <input type="hidden" name="next" value={next} />
      <FormMessage text={state?.message} />
      <Field name="name" label="পুরো নাম" autoComplete="name" defaultValue={state?.values?.name} errors={state?.errors?.name} />
      <Field name="email" label="ইমেইল" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      <Field name="password" label="পাসওয়ার্ড" type="password" autoComplete="new-password" errors={state?.errors?.password} hint="অন্তত ৮ অক্ষর, একটি ইংরেজি বর্ণ ও একটি সংখ্যাসহ।" />
      <Field name="confirm" label="পাসওয়ার্ড আবার লিখুন" type="password" autoComplete="new-password" errors={state?.errors?.confirm} />
      <SubmitButton pending={pending} pendingText="অ্যাকাউন্ট খোলা হচ্ছে…">অ্যাকাউন্ট খুলুন</SubmitButton>
      <p className="text-[15px] text-ink-2">
        আগে থেকে অ্যাকাউন্ট আছে? <Link href={`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-green underline underline-offset-4">লগইন করুন</Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  const next = useNext();
  const [state, action, pending] = useActionState(login, undefined);
  const formRef = useErrorFocus(state);
  return (
    <form ref={formRef} action={action} className="grid gap-5" noValidate>
      <RequiredNote />
      <input type="hidden" name="next" value={next} />
      <FormMessage text={state?.message} />
      <Field name="email" label="ইমেইল" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      <Field name="password" label="পাসওয়ার্ড" type="password" autoComplete="current-password" errors={state?.errors?.password} />
      <SubmitButton pending={pending} pendingText="লগইন হচ্ছে…">লগইন করুন</SubmitButton>
      <div className="flex flex-wrap justify-between gap-2 text-[15px]">
        <Link href="/reset-password" className="text-green underline underline-offset-4">পাসওয়ার্ড ভুলে গেছেন?</Link>
        <Link href="/register" className="text-ink-2 underline underline-offset-4">নতুন অ্যাকাউন্ট খুলুন</Link>
      </div>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  const formRef = useErrorFocus(state);
  if (state?.ok)
    return (
      <div className="grid gap-5">
        <FormMessage text={state.message} ok />
        <Link href="/login" className="text-[15px] text-green underline underline-offset-4">লগইন পাতায় ফিরুন</Link>
      </div>
    );
  return (
    <form ref={formRef} action={action} className="grid gap-5" noValidate>
      <RequiredNote />
      <FormMessage text={state?.message} />
      <Field name="email" label="অ্যাকাউন্টের ইমেইল" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      <SubmitButton pending={pending} pendingText="পাঠানো হচ্ছে…">রিসেট লিংক পাঠান</SubmitButton>
      <Link href="/login" className="text-[15px] text-ink-2 underline underline-offset-4">লগইন পাতায় ফিরুন</Link>
    </form>
  );
}

export function ResetForm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const formRef = useErrorFocus(state);
  return (
    <form ref={formRef} action={action} className="grid gap-5" noValidate>
      <RequiredNote />
      <input type="hidden" name="token" value={token} />
      <FormMessage text={state?.message ?? (state?.errors?.token ? "লিংকটি সঠিক নয়। নতুন রিসেট লিংক চান।" : undefined)} />
      <Field name="password" label="নতুন পাসওয়ার্ড" type="password" autoComplete="new-password" errors={state?.errors?.password} hint="অন্তত ৮ অক্ষর, একটি ইংরেজি বর্ণ ও একটি সংখ্যাসহ।" />
      <Field name="confirm" label="নতুন পাসওয়ার্ড আবার লিখুন" type="password" autoComplete="new-password" errors={state?.errors?.confirm} />
      <SubmitButton pending={pending} pendingText="সংরক্ষণ হচ্ছে…">নতুন পাসওয়ার্ড সংরক্ষণ করুন</SubmitButton>
      {state?.message && <Link href="/reset-password" className="text-[15px] text-green underline underline-offset-4">নতুন রিসেট লিংক চান</Link>}
    </form>
  );
}
