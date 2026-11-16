"use client";

import { useCallback, useSyncExternalStore } from "react";
import { bn } from "@/lib/bn";

const EVENT = "writing-assignment-change";
const read = (key: string) => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

/** দৈনিক লেখার কাজ — শিক্ষার্থীর বাক্যগুলো এই ব্রাউজারে সংরক্ষিত থাকে (সার্ভারে যায় না)। */
export function AssignmentBox({
  storageKey,
  label = "আমার ৫টি বাক্য",
  rows = 6,
  placeholder = "প্রতি লাইনে একটি বাক্য লিখুন…",
  count: mode = "lines",
  lang = "en",
}: { storageKey: string; label?: string; rows?: number; placeholder?: string; count?: "lines" | "words"; lang?: string }) {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener(EVENT, cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener(EVENT, cb);
    };
  }, []);
  const text = useSyncExternalStore(subscribe, () => read(storageKey), () => "");
  const save = (v: string) => {
    try {
      localStorage.setItem(storageKey, v);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  const count = text.split(mode === "words" ? /\s+/ : /\n+/).map((s) => s.trim()).filter(Boolean).length;
  return (
    <div className="mt-4">
      <label htmlFor={`${storageKey}-box`} className="font-semibold">{label}</label>
      <textarea
        id={`${storageKey}-box`}
        lang={lang}
        rows={rows}
        value={text}
        onChange={(e) => save(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-line-strong bg-paper p-3 text-[16px] leading-7 focus:border-green focus:outline-none"
      />
      <p className="mt-1 text-sm text-muted" aria-live="polite">{bn(count)}{mode === "words" ? "টি শব্দ" : "টি বাক্য"} লেখা হয়েছে{text ? " · এই ডিভাইসে সংরক্ষিত" : ""}</p>
    </div>
  );
}
