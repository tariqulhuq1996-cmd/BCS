"use client";

import { useEffect, useRef, useState } from "react";
import { markTourSeen } from "@/lib/student/actions";
import { bn } from "@/lib/bn";

const STEPS = [
  {
    title: "স্বাগতম! এটি আপনার Dashboard",
    body: "প্রতিদিন এখানে এসে \"আজ আপনার করণীয়\" দেখুন। প্রস্তুতি ধাপে ধাপে এগোয়: একটি ধাপ শেষ হলে পরেরটি খোলে।",
  },
  {
    title: "প্রতিদিনের তিনটি কাজ",
    body: "১) মূল পথের পরের ধাপ, ২) Revision: ভুল করা প্রশ্ন নির্দিষ্ট দিন পরপর ফিরে আসে, ৩) সাম্প্রতিক বিষয়াবলির ২০টি প্রশ্ন। ওপরে দেখবেন টানা কত দিন পড়ছেন আর আজকের লক্ষ্য কতটা হলো।",
  },
  {
    title: "ফলাফল থেকে শিখুন",
    body: "পরীক্ষার পর প্রতিটি প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা দেখুন। দরকারি প্রশ্ন ☆ দিয়ে সংরক্ষণ করে নিজের নোট লিখে রাখুন। কোনো প্রশ্নে ভুল পেলে \"ভুল জানান\" চাপুন।",
  },
  {
    title: "ওপরের মেনু",
    body: "ডানে নিজের নাম চাপলে প্রোফাইল, সংরক্ষিত প্রশ্ন, প্রস্তুতি রিপোর্ট আর লেখার আকার ও থিম বদলানোর ব্যবস্থা। 🔍 দিয়ে যেকোনো প্রশ্ন খুঁজতে পারবেন।",
  },
];

/** প্রথমবার Dashboard খুললে ছোট পরিচিতি (একবারই; শেষ বা বন্ধ করলে আর দেখায় না)। */
export function DashboardTour() {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const done = () => {
    ref.current?.close();
  };
  const last = i === STEPS.length - 1;
  return (
    <dialog
      ref={ref}
      onClose={() => void markTourSeen()}
      aria-labelledby="tour-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="p-6">
        <p className="text-sm font-semibold text-green">পরিচিতি {bn(i + 1)}/{bn(STEPS.length)}</p>
        <h2 id="tour-title" className="mt-1 text-xl font-bold">{STEPS[i].title}</h2>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{STEPS[i].body}</p>
        <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full ${k === i ? "w-6 bg-green" : "w-1.5 bg-line-strong"}`} />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={done} className="text-[15px] text-ink-2 underline underline-offset-4">
            পরিচিতি বাদ দিন
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} className="rounded-lg border border-line-strong px-4 py-2 font-semibold hover:border-green">
                আগে
              </button>
            )}
            <button type="button" autoFocus onClick={() => (last ? done() : setI(i + 1))} className="rounded-lg bg-green px-5 py-2 font-semibold text-white hover:bg-green-strong dark:text-paper">
              {last ? "শুরু করি" : "পরের"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
