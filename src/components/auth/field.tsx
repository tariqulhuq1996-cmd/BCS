"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * প্রবেশযোগ্য ফর্ম-ঘর (WCAG 2.2):
 *  - দৃশ্যমান label, input-এর সঙ্গে for/id দিয়ে যুক্ত (1.3.1, 2.5.3, 3.3.2)
 *  - আবশ্যক ঘরে দৃশ্যমান * আর required; ঐচ্ছিক ঘরে "(ঐচ্ছিক)" (3.3.2)
 *  - নির্দেশনা (hint) সবসময় দেখায়, ত্রুটি হলেও; দুটোই aria-describedby দিয়ে যুক্ত (3.3.1, 3.3.3)
 *  - ত্রুটি লেখায় ও চিহ্নে, শুধু রঙে নয়; aria-invalid (1.4.1, 3.3.1)
 *  - সঠিক autocomplete (1.3.5); পাসওয়ার্ড পেস্ট ও পাসওয়ার্ড-ম্যানেজার চলে (3.3.8)
 *  - পাসওয়ার্ড দেখানো/লুকানোর বোতাম — ৪৪px লক্ষ্য, aria-pressed (2.5.8, 4.1.2)
 */
export function Field({
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  errors,
  hint,
  required = true,
  inputMode,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  errors?: string[];
  hint?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = `f-${name}`;
  const hasError = !!errors?.length;
  const describedBy = [hint ? `${id}-hint` : null, hasError ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  const optional = !required && !/ঐচ্ছিক/.test(label);

  const inputClass = `w-full rounded-md border bg-surface px-3 py-2.5 text-[16px] outline-none focus:border-green focus:ring-2 focus:ring-green/25 ${hasError ? "border-danger" : "border-line-strong"} ${isPassword ? "pr-24" : ""}`;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[15px] font-medium">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {" "}*
          </span>
        )}
        {optional && <span className="font-normal text-muted"> (ঐচ্ছিক)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && show ? "text" : type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          required={required}
          aria-required={required || undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          inputMode={inputMode ?? (type === "email" ? "email" : type === "tel" ? "tel" : undefined)}
          spellCheck={type === "email" || isPassword ? false : undefined}
          autoCapitalize={type === "email" || isPassword ? "none" : undefined}
          className={inputClass}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            aria-controls={id}
            aria-label={show ? `${label} লুকান` : `${label} দেখান`}
            className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center gap-1.5 rounded-r-md px-3 text-sm font-medium text-green hover:bg-green-wash"
          >
            <EyeIcon off={show} />
            <span aria-hidden="true">{show ? "লুকান" : "দেখান"}</span>
          </button>
        )}
      </div>
      {hasError && (
        <p id={`${id}-err`} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <span aria-hidden="true">⚠</span>
          <span>
            <span className="sr-only">ত্রুটি: </span>
            {errors![0]}
          </span>
        </p>
      )}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** ফর্মের শুরুতে: * চিহ্নের অর্থ (3.3.2) */
export function RequiredNote() {
  return (
    <p className="text-sm text-muted">
      <span className="text-danger" aria-hidden="true">*</span> চিহ্নিত ঘর পূরণ করা আবশ্যক।
    </p>
  );
}

/** জমা দেওয়ার পর ত্রুটি থাকলে প্রথম ভুল ঘরে focus — কিবোর্ড ও স্ক্রিন-রিডার ব্যবহারকারী সরাসরি সেখানে পৌঁছান (3.3.1) */
export function useErrorFocus<T>(state: T | undefined): RefObject<HTMLFormElement | null> {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state) return;
    const el = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus();
  }, [state]);
  return ref;
}

