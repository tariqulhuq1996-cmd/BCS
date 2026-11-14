"use client";

import { useActionState, useState } from "react";
import { resetMyProgress } from "@/lib/student/actions";
import { FormMessage } from "@/components/auth/ui";

/** Dashboard-এর নিচে: নিজের অগ্রগতি রিসেট (নিশ্চিত করতে "রিসেট" লিখতে হয়)। */
export function ResetProgress() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(resetMyProgress, undefined);
  const [word, setWord] = useState("");

  if (state?.ok)
    return (
      <div className="mt-4 max-w-xl">
        <FormMessage text={state.message} ok />
      </div>
    );

  return (
    <div className="mt-4 max-w-xl">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded-lg border border-danger px-4 py-2.5 font-semibold text-danger hover:bg-danger-wash">
          Dashboard রিসেট করুন
        </button>
      ) : (
        <form action={action} className="grid gap-4 rounded-xl border border-danger bg-danger-wash/40 p-5">
          <div>
            <p className="font-semibold">সত্যিই রিসেট করবেন?</p>
            <p className="mt-1 text-[15px] text-ink-2">
              সব ধাপের অগ্রগতি, পরীক্ষার ফলাফল, ভুলের তালিকা, Revision, Mastery, অর্জন ও সাম্প্রতিক বিষয়াবলির অনুশীলন মুছে যাবে — আর ফেরানো যাবে না।
              অ্যাকাউন্ট, প্রোফাইল, সংরক্ষিত প্রশ্ন ও নোট থেকে যাবে।
            </p>
          </div>
          <FormMessage text={state?.message} />
          <label className="grid gap-1.5 text-[15px]">
            <span>নিশ্চিত করতে নিচে <strong>রিসেট</strong> লিখুন</span>
            <input name="confirm" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" className="rounded-lg border border-line-strong bg-surface px-3 py-2.5" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending || word.trim() !== "রিসেট"} className="cursor-pointer rounded-lg bg-danger px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? "রিসেট হচ্ছে…" : "হ্যাঁ, সব রিসেট করুন"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setWord(""); }} className="cursor-pointer rounded-lg border border-line-strong px-5 py-2.5">
              বাতিল
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
