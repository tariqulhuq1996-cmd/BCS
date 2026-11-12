"use client";

import { useActionState } from "react";
import { updateQuestionAction } from "@/lib/admin/actions";
import { Notice, btn, input } from "./ui";

const LETTERS = ["ক", "খ", "গ", "ঘ"];
type Q = {
  id: string; uid: string; text: string; options: string[]; correctIndex: number | null; explanation: string | null; explanationStatus: string;
  status: string; difficulty: string | null; source: string | null; verifyNote: string | null; subtopicCode: string;
};

export function QuestionForm({ q }: { q: Q }) {
  const [state, action, pending] = useActionState(updateQuestionAction, undefined);
  return (
    <form action={action} className="mt-6 grid max-w-3xl gap-5">
      <input type="hidden" name="id" value={q.id} />
      {state?.message && <Notice kind={state.ok ? "ok" : "error"}>{state.message}</Notice>}
      <p className="text-sm text-muted"><span className="text-danger" aria-hidden="true">*</span> চিহ্নিত ঘর পূরণ করা আবশ্যক।</p>
      <label className="grid gap-1.5"><span className="font-medium">প্রশ্ন<span className="text-danger" aria-hidden="true"> *</span></span><textarea name="text" defaultValue={q.text} rows={3} className={input} required /></label>
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-medium">অপশন<span className="text-danger" aria-hidden="true"> *</span> ও সঠিক উত্তর</legend>
        <p className="text-sm text-muted">বাঁয়ের বৃত্তে সঠিক উত্তর বাছুন; চারটি অপশনই লিখতে হবে।</p>
        {q.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="flex min-h-6 items-center gap-1.5 px-1 text-sm"><input type="radio" name="answer" value={i} defaultChecked={q.correctIndex === i} />{LETTERS[i]}<span className="sr-only"> সঠিক উত্তর</span></label>
            <input name={`opt${i}`} defaultValue={o} className={`${input} flex-1`} aria-label={`অপশন ${LETTERS[i]} (আবশ্যক)`} required aria-required="true" />
          </div>
        ))}
        <label className="flex min-h-6 items-center gap-1.5 px-1 text-sm text-muted"><input type="radio" name="answer" value="" defaultChecked={q.correctIndex == null} />উত্তর নেই</label>
      </fieldset>
      <label className="grid gap-1.5"><span className="font-medium">ব্যাখ্যা</span><textarea name="explanation" defaultValue={q.explanation ?? ""} rows={4} className={input} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5"><span className="font-medium">ব্যাখ্যার অবস্থা</span>
          <select name="explanationStatus" defaultValue={q.explanationStatus === "NONE" ? "DRAFT" : q.explanationStatus} className={input}><option value="DRAFT">খসড়া (যাচাই চলছে)</option><option value="VERIFIED">যাচাইকৃত</option></select>
        </label>
        <label className="grid gap-1.5"><span className="font-medium">প্রশ্নের অবস্থা</span>
          <select name="status" defaultValue={q.status} className={input}><option value="DRAFT">খসড়া</option><option value="VERIFIED">যাচাইকৃত</option><option value="PUBLISHED">প্রকাশিত</option><option value="RETIRED">বাতিল</option></select>
        </label>
        <label className="grid gap-1.5"><span className="font-medium">উপবিষয় কোড<span className="text-danger" aria-hidden="true"> *</span></span><input name="subtopic" defaultValue={q.subtopicCode} className={`${input} font-mono`} required /></label>
        <label className="grid gap-1.5"><span className="font-medium">কঠিনতা</span>
          <select name="difficulty" defaultValue={q.difficulty ?? ""} className={input}><option value="">অজানা</option><option value="EASY">সহজ</option><option value="MEDIUM">মাঝারি</option><option value="HARD">কঠিন</option></select>
        </label>
        <label className="grid gap-1.5 sm:col-span-2"><span className="font-medium">উৎস</span><input name="source" defaultValue={q.source ?? ""} className={input} /></label>
        <label className="grid gap-1.5 sm:col-span-2"><span className="font-medium">যাচাই-টীকা</span><input name="verifyNote" defaultValue={q.verifyNote ?? ""} className={input} /></label>
      </div>
      <div><button disabled={pending} className={btn}>{pending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}</button></div>
    </form>
  );
}
