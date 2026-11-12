"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { reportQuestion, saveNote, toggleSaved } from "@/lib/student/actions";
import { REPORT_REASONS } from "@/lib/student/reasons";

const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm";

/** প্রতিটি প্রশ্নের নিচে: ☆ সংরক্ষণ, নিজের নোট, আর "ভুল জানান"। */
export function QuestionTools({ qid, saved: saved0, note: note0 }: { qid: string; saved: boolean; note: string }) {
  const [saved, setSaved] = useState(saved0);
  const [note, setNote] = useState(note0);
  const [draft, setDraft] = useState(note0);
  const [panel, setPanel] = useState<"none" | "note" | "report">("none");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [rep, reportAction, reporting] = useActionState(reportQuestion, undefined);
  const id = useId();

  const flip = () =>
    start(async () => {
      const r = await toggleSaved(qid, !saved);
      if (r.error) return setMsg({ ok: false, text: r.error });
      setSaved(r.saved);
      setMsg({ ok: true, text: r.saved ? "সংরক্ষিত প্রশ্নে যোগ হয়েছে।" : "সংরক্ষিত প্রশ্ন থেকে বাদ দেওয়া হয়েছে।" });
    });
  const keep = () =>
    start(async () => {
      const r = await saveNote(qid, draft);
      if (r.error) return setMsg({ ok: false, text: r.error });
      setSaved(true);
      setNote(r.note);
      setPanel("none");
      setMsg({ ok: true, text: r.ok ?? "নোট সংরক্ষিত হয়েছে।" });
    });

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={flip} disabled={pending} aria-pressed={saved} className={`${chip} ${saved ? "border-green bg-green-wash font-semibold text-green" : "border-line text-ink-2 hover:border-green"}`}>
          <span aria-hidden="true">{saved ? "★" : "☆"}</span>
          {saved ? "সংরক্ষিত" : "সংরক্ষণ করুন"}
        </button>
        <button type="button" onClick={() => setPanel(panel === "note" ? "none" : "note")} aria-expanded={panel === "note"} aria-controls={`${id}-note`} className={`${chip} border-line text-ink-2 hover:border-green`}>
          {note ? "নোট দেখুন/বদলান" : "নোট লিখুন"}
        </button>
        <button type="button" onClick={() => setPanel(panel === "report" ? "none" : "report")} aria-expanded={panel === "report"} aria-controls={`${id}-rep`} className={`${chip} border-line text-ink-2 hover:border-danger hover:text-danger`}>
          ভুল জানান
        </button>
        {msg && (
          <span role="status" className={`text-sm ${msg.ok ? "text-green" : "text-danger"}`}>
            {msg.text}
          </span>
        )}
      </div>

      {note && panel !== "note" && (
        <p className="mt-2 whitespace-pre-line rounded-md bg-paper px-3 py-2 text-[15px]">
          <span className="font-semibold">আমার নোট: </span>
          {note}
        </p>
      )}

      {panel === "note" && (
        <div id={`${id}-note`} className="mt-3 grid gap-2">
          <label htmlFor={`${id}-ta`} className="text-sm font-semibold">আমার নোট</label>
          <textarea id={`${id}-ta`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={2000} className="rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]" placeholder="মনে রাখার কৌশল, সূত্র বা নিজের ব্যাখ্যা…" />
          <div className="flex gap-2">
            <button type="button" onClick={keep} disabled={pending} className="rounded-md bg-green px-4 py-1.5 text-[15px] font-semibold text-white hover:bg-green-strong disabled:opacity-60 dark:text-paper">
              {pending ? "সংরক্ষণ হচ্ছে…" : "নোট সংরক্ষণ"}
            </button>
            <button type="button" onClick={() => { setDraft(note); setPanel("none"); }} className="rounded-md px-3 py-1.5 text-[15px] text-ink-2">বাতিল</button>
          </div>
        </div>
      )}

      {panel === "report" && (
        <form id={`${id}-rep`} action={reportAction} className="mt-3 grid gap-2 rounded-lg border border-line bg-paper p-3">
          <input type="hidden" name="questionId" value={qid} />
          {rep?.ok ? (
            <p role="status" className="text-[15px] text-green">{rep.message}</p>
          ) : (
            <>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1 text-sm font-semibold">কী ধরনের ভুল?</legend>
                {Object.entries(REPORT_REASONS).map(([k, label], n) => (
                  <label key={k} className="flex items-center gap-2 text-[15px]">
                    <input type="radio" name="reason" value={k} defaultChecked={n === 0} className="size-4 accent-[var(--green)]" />
                    {label}
                  </label>
                ))}
              </fieldset>
              <label htmlFor={`${id}-rn`} className="mt-1 text-sm font-semibold">বিবরণ (ঐচ্ছিক)</label>
              <textarea id={`${id}-rn`} name="note" rows={2} maxLength={1000} className="rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]" placeholder="যেমন: সঠিক উত্তর হবে খ, কারণ… (সম্ভব হলে উৎস দিন)" />
              {rep?.message && <p role="alert" className="text-sm text-danger">{rep.message}</p>}
              <div>
                <button disabled={reporting} className="rounded-md bg-ink px-4 py-1.5 text-[15px] font-semibold text-paper disabled:opacity-60">
                  {reporting ? "পাঠানো হচ্ছে…" : "অভিযোগ পাঠান"}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
