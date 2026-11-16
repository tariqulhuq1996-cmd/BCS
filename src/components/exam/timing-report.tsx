import { bn, bnNum } from "@/lib/bn";
import { strategicNotes, type TimingReport } from "@/lib/exam/timing";

const sec = (x: number | null) => (x == null ? "—" : `${bnNum(x, 1)} সে.`);
const mmss = (x: number) => {
  const s = Math.round(x);
  return bn(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
};
const p = (x: number | null) => (x == null ? "—" : `${bnNum(x, 1)}%`);

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <table className="mt-3 w-full border-collapse text-[15px]">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-line">
            <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">{k}</th>
            <td className="py-2 text-right font-semibold tabular">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** বাস্তব BCS Preliminary-র আদলে পূর্ণাঙ্গ Performance Report: সার্বিক, সময়, Guessing, বিষয়ভিত্তিক ও কৌশলগত মূল্যায়ন। */
export function TimingReportView({ t }: { t: TimingReport }) {
  const notes = strategicNotes(t);
  return (
    <section aria-labelledby="perf" className="mt-10">
      <h2 id="perf" className="text-xl font-bold">Performance Report</h2>
      <p className="mt-1 text-[15px] text-ink-2">
        বাস্তব BCS Preliminary-র হিসাবে: প্রতি প্রশ্নে বরাদ্দ {bn(t.secPerQ)} সেকেন্ড, যার মধ্যে উত্তরপত্রে চিহ্নিত করার জন্য {bn(t.markSec)} সেকেন্ড ধরা হয়েছে (শুধু উত্তর দেওয়া প্রশ্নে, একবার করে)।
      </p>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <h3 className="font-semibold">A. Overall Performance</h3>
          <Table rows={[
            ["মোট প্রশ্ন", bn(t.n)],
            ["সঠিক উত্তর", `${bn(t.correct)} (${p(t.correctPct)})`],
            ["ভুল উত্তর", `${bn(t.wrong)} (${p(t.wrongPct)})`],
            ["উত্তর না দেওয়া", bn(t.unanswered)],
            [`মোট নম্বর (প্রতি ভুলে ${bn(String(t.negativeMark))} কাটা)`, bn(String(Math.round(t.net * 100) / 100)).replace("-", "−")],
            ["Direct · Guess · Skip", `${bn(t.direct)} · ${bn(t.guess)} · ${bn(t.skip)}`],
          ]} />
        </div>

        <div>
          <h3 className="font-semibold">B. Time Management Analysis</h3>
          {t.hasTime ? (
            <Table rows={[
              ["পরীক্ষার সময়সীমা", t.limitSec ? `${mmss(t.limitSec)} মিনিট` : `${mmss(t.allowedSec)} মিনিট (বরাদ্দ)`],
              ["প্রকৃত ব্যবহৃত সময়", `${mmss(t.usedSec)} মিনিট`],
              ["প্রশ্ন সমাধানে মোট সময়", `${mmss(t.solveSec)} মিনিট`],
              ["উত্তর চিহ্নিত করার অতিরিক্ত সময়", `${mmss(t.markTotal)} মিনিট (${bn(t.answered)} × ${bn(t.markSec)} সে.)`],
              ["প্রতি প্রশ্নে গড় সমাধান সময়", sec(t.avgSolve)],
              [`প্রতি প্রশ্নে গড় মোট সময় (সমাধান + ${bn(t.markSec)} সে.)`, sec(t.avgTotal)],
              ["সবচেয়ে কম সময়ের প্রশ্ন", t.fastest ? `প্রশ্ন ${bn(t.fastest.no)} — ${sec(t.fastest.sec)}` : "—"],
              ["সবচেয়ে বেশি সময়ের প্রশ্ন", t.slowest ? `প্রশ্ন ${bn(t.slowest.no)} — ${sec(t.slowest.sec)}` : "—"],
              [`${bn(t.secPerQ)} সেকেন্ডের মধ্যে উত্তর`, `${bn(t.within)}টি`],
              [`${bn(t.secPerQ)} সেকেন্ডের বেশি সময় নেওয়া`, `${bn(t.over)}টি`],
            ]} />
          ) : (
            <p className="mt-3 text-[15px] text-ink-2">এই পরীক্ষায় প্রশ্নভিত্তিক সময় রেকর্ড হয়নি (নতুন ব্যবস্থার আগের পরীক্ষা), তাই সময়ের বিশ্লেষণ দেখানো হচ্ছে না।</p>
          )}
        </div>

        <div>
          <h3 className="font-semibold">C. Intelligent Guessing Analysis</h3>
          {t.guessTotal ? (
            <Table rows={[
              ["মোট Guess-based প্রশ্ন", bn(t.guessTotal)],
              ["সঠিক উত্তর", bn(t.guessRight)],
              ["ভুল উত্তর", bn(t.guessWrong)],
              ["Guessing Accuracy", p(t.guessAcc)],
              ["দুটি ভুল অপশন সঠিকভাবে বাদ", `${bn(t.elimBoth)}বার`],
              ["সঠিক উত্তর বাদ পড়েছে", `${bn(t.elimLost)}বার`],
              ["অবশিষ্ট দুটি থেকে সঠিকটি বাছাইয়ের হার", p(t.pickAcc)],
            ]} />
          ) : (
            <p className="mt-3 text-[15px] text-ink-2">এই পরীক্ষায় কোনো প্রশ্নে দুটি অপশন বাদ দিয়ে অনুমান (Guess) করা হয়নি।</p>
          )}
        </div>

        <div>
          <h3 className="font-semibold">D. Subject-wise Performance</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[26rem] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b-2 border-line-strong">
                  {["বিষয়", "প্রশ্ন", "সঠিক", "ভুল", "Guess", "Accuracy", "গড় সময়"].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {t.subjects.map((s) => (
                  <tr key={s.subject} className="border-b border-line">
                    <td className="px-2 py-2">{s.subject}</td>
                    <td className="px-2 py-2 tabular">{bn(s.total)}</td>
                    <td className="px-2 py-2 tabular text-green">{bn(s.correct)}</td>
                    <td className="px-2 py-2 tabular text-danger">{bn(s.wrong)}</td>
                    <td className="px-2 py-2 tabular">{bn(s.guess)}</td>
                    <td className="px-2 py-2 tabular">{p(s.accuracy)}</td>
                    <td className="px-2 py-2 tabular">{sec(s.avgSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border-2 border-green bg-green-wash p-5">
        <h3 className="font-semibold">E. Final Strategic Assessment</h3>
        <ol className="mt-3 space-y-2.5 text-[15px] leading-relaxed">
          {notes.map((x, i) => (
            <li key={x.q}><b>{bn(i + 1)}. {x.q}</b> {bn(x.a)}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
