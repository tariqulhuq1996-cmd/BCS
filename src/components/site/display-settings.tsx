"use client";

import { useEffect, useId, useState } from "react";

/**
 * লেখার আকার ও থিম — এই ডিভাইসের ব্রাউজারে মনে থাকে (localStorage)।
 * পাতা আঁকার আগেই layout-এর ছোট স্ক্রিপ্ট মানগুলো <html>-এ বসায়, তাই ঝলক দেখা যায় না।
 */
export const PREFS_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("bcs-theme"),s=localStorage.getItem("bcs-text");if(t==="light"||t==="dark")d.dataset.theme=t;if(s==="lg"||s==="xl")d.dataset.text=s}catch(e){}`;

type Theme = "auto" | "light" | "dark";
type Size = "md" | "lg" | "xl";

function read<T extends string>(key: string, ok: readonly T[], dflt: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && ok.includes(v) ? v : dflt;
  } catch {
    return dflt;
  }
}
function write(key: string, v: string | null) {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {}
}

/** <html>-এ পছন্দ বসানো/সরানো (null = সরানো)। */
function applyAttr(name: "data-theme" | "data-text", v: string | null) {
  if (v == null) document.documentElement.removeAttribute(name);
  else document.documentElement.setAttribute(name, v);
}

const seg = (on: boolean) =>
  `rounded-md px-2.5 py-1 text-sm ${on ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`;

export function DisplaySettings({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("auto");
  const [size, setSize] = useState<Size>("md");
  const id = useId();
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- ব্রাউজারে সংরক্ষিত পছন্দ শুধু client-এ পড়া যায় */
    setTheme(read("bcs-theme", ["auto", "light", "dark"] as const, "auto"));
    setSize(read("bcs-text", ["md", "lg", "xl"] as const, "md"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const pickTheme = (t: Theme) => {
    setTheme(t);
    write("bcs-theme", t === "auto" ? null : t);
    applyAttr("data-theme", t === "auto" ? null : t);
  };
  const pickSize = (s: Size) => {
    setSize(s);
    write("bcs-text", s === "md" ? null : s);
    applyAttr("data-text", s === "md" ? null : s);
  };

  return (
    <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-size`} className="text-sm text-ink-2">লেখার আকার</span>
        <div role="group" aria-labelledby={`${id}-size`} className="flex rounded-lg bg-paper p-0.5">
          {(
            [
              ["md", "সাধারণ"],
              ["lg", "বড়"],
              ["xl", "আরও বড়"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={size === k} onClick={() => pickSize(k)} className={seg(size === k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-theme`} className="text-sm text-ink-2">থিম</span>
        <div role="group" aria-labelledby={`${id}-theme`} className="flex rounded-lg bg-paper p-0.5">
          {(
            [
              ["auto", "ডিভাইসের মতো"],
              ["light", "হালকা"],
              ["dark", "গাঢ়"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={theme === k} onClick={() => pickTheme(k)} className={seg(theme === k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** service worker নিবন্ধন (শুধু প্রোডাকশনে; ইন্টারনেট না থাকলে "সংযোগ নেই" পাতা)। */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
