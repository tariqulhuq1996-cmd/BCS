"use client";

import { useActionState, useState, useTransition } from "react";
import { importAction } from "@/lib/admin/actions";
import { bnNum } from "@/lib/bn";
import { Notice, btn, btnGhost, input } from "./ui";

/** ফাইল বাছাই → পূর্বরূপ (কিছু লেখা হয় না) → নিশ্চিত করলে Import। ফাইল ক্লায়েন্টের অবস্থায় থাকে, তাই দুবার বাছাই করতে হয় না। */
export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("DRAFT");
  const [state, action] = useActionState(importAction, undefined);
  const [pending, start] = useTransition();

  const run = (confirm: boolean) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("status", status);
    if (confirm) fd.set("confirm", "1");
    start(() => action(fd));
  };
  const r = state?.report;

  return (
    <div className="mt-6 grid max-w-3xl gap-5">
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-5">
        <label className="grid gap-1.5">
          <span className="font-medium">প্রশ্নের ফাইল (.csv, .json বা .xlsx)</span>
          <input type="file" accept=".csv,.json,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[15px]" />
        </label>
        <label className="grid gap-1.5 sm:max-w-xs">
          <span className="font-medium">নতুন প্রশ্নের অবস্থা</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
            <option value="DRAFT">খসড়া (প্রস্তাবিত — পরে যাচাই করে প্রকাশ)</option>
            <option value="VERIFIED">যাচাইকৃত (প্রকাশিত নয়)</option>
            <option value="PUBLISHED">সরাসরি প্রকাশিত</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={!file || pending} onClick={() => run(false)} className={btnGhost}>{pending && !state?.confirmed ? "পরীক্ষা হচ্ছে…" : "পূর্বরূপ দেখুন"}</button>
          <button type="button" disabled={!file || pending || !r || state?.confirmed || r.inserted === 0} onClick={() => run(true)} className={btn}>
            {r && !state?.confirmed ? `${bnNum(r.inserted)}টি প্রশ্ন Import করুন` : "Import করুন"}
          </button>
        </div>
        <p className="text-sm text-muted">প্রথমে পূর্বরূপ দেখুন: কিছুই লেখা হয় না, শুধু কতটি যোগ হবে, কতটি বাদ পড়বে আর কোন সারিতে ত্রুটি তা দেখায়।</p>
      </div>

      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {r && (
        <section aria-live="polite" className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-bold">{state?.confirmed ? "Import সম্পন্ন" : "পূর্বরূপ (এখনও কিছু লেখা হয়নি)"}</h2>
          <ul className="mt-3 grid gap-1 text-[15px]">
            <li>ফাইলে সারি: <b>{bnNum(r.rows)}</b></li>
            <li>{state?.confirmed ? "যোগ হয়েছে" : "যোগ হবে"}: <b className="text-green">{bnNum(r.inserted)}</b></li>
            <li>হুবহু পুনরাবৃত্তি (বাদ): <b>{bnNum(r.duplicates.length)}</b></li>
            <li>প্রায়-একই (খসড়া হিসেবে, টীকাসহ): <b className="text-omr">{bnNum(r.nearDuplicates.length)}</b></li>
            <li>ত্রুটিপূর্ণ সারি (বাদ): <b className="text-danger">{bnNum(r.errors.length)}</b></li>
          </ul>
          {r.errors.length > 0 && (
            <details className="mt-3" open>
              <summary className="cursor-pointer font-semibold">ত্রুটির তালিকা</summary>
              <ul className="mt-2 max-h-60 overflow-auto text-sm">{r.errors.slice(0, 200).map((e) => <li key={e.row}>সারি {bnNum(e.row)}: {e.message}</li>)}</ul>
            </details>
          )}
          {r.duplicates.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold">হুবহু পুনরাবৃত্তি</summary>
              <ul className="mt-2 max-h-60 overflow-auto text-sm">{r.duplicates.slice(0, 200).map((d) => <li key={d.row}>সারি {bnNum(d.row)}: {d.matches}-এর সঙ্গে হুবহু এক</li>)}</ul>
            </details>
          )}
          {r.nearDuplicates.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold">প্রায়-একই প্রশ্ন</summary>
              <ul className="mt-2 max-h-60 overflow-auto text-sm">{r.nearDuplicates.slice(0, 200).map((d) => <li key={d.row}>সারি {bnNum(d.row)}: {d.matches}-এর সঙ্গে {bnNum(d.similarity)}% মিল</li>)}</ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
