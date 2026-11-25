import Link from "next/link";
import { bn, bnNum } from "@/lib/bn";
import type { ExamReport } from "@/lib/exam/performance";
import { Card, Kpi, Meter, StatusChip, Unavailable, fmt, signed } from "./ui";


const DIFF_BN: Record<string, string> = { EASY: "সহজ", MEDIUM: "মাঝারি", HARD: "কঠিন" };
const BASE_BN: Record<string, string> = {
  own_diff: "আপনার আগের পরীক্ষায় একই বিষয় ও কঠিনতার সঠিক উত্তরের গড়",
  own_subject: "আপনার আগের পরীক্ষায় এই বিষয়ের সঠিক উত্তরের গড়",
  exam_subject: "এই পরীক্ষায় এই বিষয়ের সঠিক উত্তরের মধ্যমা",
  budget: "বরাদ্দ সময়",
};
const DIAG_ICON: Record<string, string> = { strong: "★", balanced: "✓", developing: "↗", cautious: "◐", reckless: "!", foundation: "!" };
const mmss = (sec: number) => `${bn(Math.floor(sec / 60))} মি. ${bn(Math.round(sec % 60))} সে.`;

/**
 * পরীক্ষা-পরবর্তী বিশ্লেষণের মূল অংশ: সারাংশ, মূল্যায়ন, সময়, বিষয়ভিত্তিক, সময় নষ্ট হওয়া প্রশ্ন, Guessing, অন্তর্দৃষ্টি, করণীয় ও আগের পরীক্ষার সঙ্গে তুলনা।
 * /performance/[attemptId] পাতা এবং পরীক্ষা জমার পরের ফলাফল-পাতা — দুই জায়গাতেই একই অংশ।
 */
export function ExamAnalysis({ r }: { r: ExamReport }) {
  const s = r.snapshot;
  const t = r.time;
  const diagTone = r.diagnosis.key === "strong" || r.diagnosis.key === "balanced" ? "border-green bg-green-wash" : r.diagnosis.key === "reckless" || r.diagnosis.key === "foundation" ? "border-danger bg-danger-wash" : "border-omr bg-omr-wash";

  return (
    <>
      {/* ── Snapshot */}
      <section aria-label="ফলাফলের সারাংশ" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label={s.scaled ? "নেট নম্বর (২০০-এর অনুপাতে)" : "প্রাপ্ত নম্বর (নেট)"}
          value={<>{bnNum(s.net200, 1)}<span className="text-base font-semibold text-muted">/২০০</span></>}
          sub={`${s.scaled ? `আসল ${bnNum(s.net, 1)}/${bn(s.total)} · ` : ""}ভুলে ${s.negativeInExam ? "কাটা" : "কাটা যেত"} −${bnNum(s.deduction, 1)}`}
          tone="green"
        />
        <Kpi label="✓ সঠিক" value={bn(s.correct)} />
        <Kpi label="✗ ভুল" value={bn(s.wrong)} tone={s.wrong ? "danger" : undefined} />
        <Kpi label="– উত্তর নয়" value={bn(s.unanswered)} />
        <Kpi label="Accuracy" value={fmt(s.accuracy, 1, "%")} sub="সঠিক ÷ উত্তর দেওয়া" />
        <Kpi label="Attempt" value={`${bnNum(s.attemptRate, 1)}%`} sub="উত্তর দেওয়া ÷ মোট" />
      </section>
      {(s.scaled || !s.negativeInExam) && (
        <p className="mt-3 text-sm text-muted">
          {s.scaled && `${bn(s.total)} প্রশ্নের পরীক্ষা, তাই নম্বর ও বরাদ্দ সময় ২০০ প্রশ্নের অনুপাতে রূপান্তরিত (নেট × ২০০ ÷ ${bn(s.total)})। `}
          {!s.negativeInExam && `এই পরীক্ষায় আসলে নম্বর কাটে না; বাস্তব Preliminary-র সঙ্গে তুলনার জন্য প্রতি ভুলে ${bn(String(r.cfg.negativeMark))} ধরে হিসাব করা হয়েছে। `}
          {s.small && <b className="text-ink-2">! মাত্র {bn(s.total)}টি প্রশ্ন — অনুপাতিক নম্বর ও মূল্যায়ন কম নির্ভরযোগ্য।</b>}
        </p>
      )}

      {/* ── রোগনির্ণয় + সময় */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="diag-h" className={`self-start rounded-xl border-2 p-4 sm:p-5 ${diagTone}`}>
          <h2 id="diag-h" className="text-sm font-semibold text-ink-2">সার্বিক মূল্যায়ন</h2>
          <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold"><span aria-hidden="true">{DIAG_ICON[r.diagnosis.key]}</span>{r.diagnosis.label}</p>
          <p className="mt-2 text-[15px] leading-relaxed">{r.diagnosis.detail}</p>
          <p className="mt-2 text-xs text-ink-2">মানদণ্ড (অ্যাডমিন বদলাতে পারেন; নেট ২০০-এর অনুপাতে): ভালো নেট {bn(r.cfg.bench.goodNet)}+, শক্তিশালী {bn(r.cfg.bench.strongNet)}+; Accuracy {bn(r.cfg.bench.accLow)}–{bn(r.cfg.bench.accHigh)}%; Attempt {bn(r.cfg.bench.attemptLow)}–{bn(r.cfg.bench.attemptHigh)}%।</p>
        </section>

        <Card id="time-h" title="সময় ব্যবস্থাপনা">
          {t.hasTime ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[15px]">
                <span>প্রশ্ন সমাধান: <b className="tabular">{mmss(t.solveSec!)}</b> / {fmt(t.solveMin, t.scaled ? 1 : 0)} মিনিট{t.scaled && <span className="text-sm text-muted"> ({bn(t.total)} প্রশ্নে বরাদ্দ)</span>}</span>
                <span className="text-ink-2">OMR: {fmt(t.omrMin, t.scaled ? 1 : 0)} মিনিট (আলাদা)</span>
              </div>
              <div className="mt-2"><Meter thick pct={t.utilization} tone={t.utilization! > 100 ? "danger" : "green"} label="বরাদ্দ সমাধান-সময়ের ব্যবহার" valueText={`${fmt(t.utilization, 0, "%")} — ${mmss(t.solveSec!)} / ${fmt(t.solveMin, 1)} মিনিট`} /></div>
              <table className="mt-3 w-full text-[15px] tabular">
                <tbody className="divide-y divide-line">
                  <tr><th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">সময়ের ব্যবহার</th><td className={`py-1.5 text-right font-semibold ${t.utilization! > 100 ? "text-danger" : ""}`}>{t.utilization! > 100 ? "! " : ""}{fmt(t.utilization, 0, "%")}</td></tr>
                  <tr><th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">উত্তর দেওয়া প্রতি প্রশ্নে গড়</th><td className="py-1.5 text-right font-semibold">{fmt(t.avgPerAttempted)} সে. <span className="font-normal text-muted">(বরাদ্দ {bnNum(t.budgetSecPerQ, 1)})</span></td></tr>
                  <tr><th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">প্রতিটি সঠিক উত্তরের খরচ <span className="text-xs text-muted">(মোট সমাধান-সময় ÷ সঠিক)</span></th><td className="py-1.5 text-right font-semibold">{fmt(t.perCorrect)} সে.</td></tr>
                  <tr><th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">সবচেয়ে সময়সাপেক্ষ বিষয়</th><td className="py-1.5 text-right font-semibold">{t.slowestSubject ? `${t.slowestSubject.name} (${bnNum(t.slowestSubject.avgSec, 1)} সে./প্রশ্ন)` : "—"}</td></tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">
                সমাধান-সময় = প্রতিটি প্রশ্নে পর্দায় কাটানো মাপা সময়ের যোগফল; OMR পূরণের সময় এতে যোগ হয়নি।
                {t.timedCount < t.total && ` ${bn(t.total - t.timedCount)}টি প্রশ্নে সময় রেকর্ড নেই (খোলা হয়নি বা পুরনো তথ্য) — সেগুলো শূন্য ধরা হয়নি।`}
              </p>
            </>
          ) : <Unavailable>এই পরীক্ষায় প্রশ্নভিত্তিক সময় রেকর্ড হয়নি, তাই সময়ের বিশ্লেষণ দেখানো যাচ্ছে না।</Unavailable>}
        </Card>
      </div>

      {/* ── বিষয়ভিত্তিক */}
      <Card id="subj-h" title="বিষয়ভিত্তিক ফলাফল (এই পরীক্ষা)" className="mt-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-[15px] tabular">
            <caption className="sr-only">বিষয়ভিত্তিক নেট নম্বর, Accuracy, Attempt, অবস্থা ও মন্তব্য</caption>
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">বিষয়</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">নেট</th>
                <th scope="col" className="w-[18%] py-2 pr-3 font-medium">Accuracy</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Attempt</th>
                <th scope="col" className="py-2 pr-3 font-medium">অবস্থা</th>
                <th scope="col" className="py-2 font-medium">মন্তব্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.subjects.map((x) => (
                <tr key={x.code} className="align-top">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">{x.name}</th>
                  <td className="py-2 pr-3 text-right font-semibold">
                    {bnNum(x.net, 1)}<span className="font-normal text-muted">/{bn(x.total)}</span>
                    {s.scaled && x.netFull != null && <span className="block text-xs font-normal text-muted">≈ {bnNum(x.netFull, 1)}/{bn(x.fullMarks!)} মানবণ্টনে</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1"><Meter pct={x.accuracy} label={`${x.name}: Accuracy`} valueText={fmt(x.accuracy, 1, "%")} tone={x.status === "weak" ? "danger" : x.status === "ok" ? "omr" : "green"} /></div>
                      <span className="w-12 text-right">{fmt(x.accuracy, 0, "%")}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right">{fmt(x.attemptRate, 0, "%")}</td>
                  <td className="py-2 pr-3"><StatusChip s={x.status} /></td>
                  <td className="py-2 text-sm text-ink-2">{x.line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── সময় নষ্ট + Guessing */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card id="waste-h" title="যেসব প্রশ্নে সময় বেশি গেছে">
          {!t.hasTime ? <Unavailable>প্রশ্নভিত্তিক সময় রেকর্ড নেই।</Unavailable>
            : r.wasters.length ? (
              <>
                <ol className="divide-y divide-line">
                  {r.wasters.map((w) => (
                    <li key={w.no} className="py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold">প্রশ্ন {bn(w.no)} · {w.subject}{w.difficulty ? ` · ${DIFF_BN[w.difficulty]}` : ""}</span>
                        <span className={`whitespace-nowrap text-sm font-semibold ${w.status === "correct" ? "text-green" : "text-danger"}`}>
                          {w.status === "correct" ? "✓ সঠিক" : w.status === "wrong" ? "✗ ভুল" : "– উত্তর নয়"}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-sm text-ink-2">{w.text}</p>
                      <p className="mt-0.5 text-sm tabular">
                        লেগেছে <b>{bnNum(w.sec, 0)} সে.</b>, প্রত্যাশিত ~{bnNum(w.baselineSec, 0)} সে. ({signed(w.excess, 0)} সে.)
                        <span className="block text-xs text-muted">প্রত্যাশা: {BASE_BN[w.baselineSource]}</span>
                      </p>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-muted">
                  শুধু “৩১.৫ সেকেন্ডের বেশি” নয় — প্রশ্নের বিষয় ও কঠিনতা অনুযায়ী আপনার নিজের সাধারণ সময়ের অন্তত দেড় গুণ লাগলে তবেই তালিকায়; নম্বর না আসা প্রশ্ন আগে।
                  {r.difficultyCoverage.known < r.difficultyCoverage.total && ` ${bn(r.difficultyCoverage.total - r.difficultyCoverage.known)}টি প্রশ্নের কঠিনতা চিহ্নিত নেই; সেগুলোর জন্য বিষয়ের গড় ধরা হয়েছে।`}
                </p>
              </>
            ) : <p className="text-[15px] text-ink-2">✓ কোনো প্রশ্নে নিজের সাধারণ সময়ের চেয়ে অস্বাভাবিক বেশি সময় লাগেনি।</p>}
        </Card>

        <Card id="guess-h" title="Guessing বিশ্লেষণ">
          {!r.guessing ? <Unavailable>এই পরীক্ষায় উত্তরের ধরন (Direct/Guess) রেকর্ড হয়নি, তাই Guessing বিশ্লেষণ সম্ভব নয়।</Unavailable>
            : r.guessing.total ? (
              <>
                <table className="w-full text-[15px] tabular">
                  <tbody className="divide-y divide-line">
                    <tr><th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">মোট Guess</th><td className="py-1.5 text-right font-semibold">{bn(r.guessing.total)}টি</td></tr>
                    <tr><th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">✓ সঠিক · ✗ ভুল</th><td className="py-1.5 text-right font-semibold">{bn(r.guessing.right)} · {bn(r.guessing.wrong)}</td></tr>
                    <tr><th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">Guess Accuracy</th><td className="py-1.5 text-right font-semibold">{fmt(r.guessing.accuracy, 1, "%")}</td></tr>
                    <tr><th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">Guess থেকে নিট নম্বর</th><td className={`py-1.5 text-right font-semibold ${r.guessing.net < 0 ? "text-danger" : "text-green"}`}>{signed(r.guessing.net)}</td></tr>
                    <tr><th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">দুটি ভুল অপশন ঠিকঠাক বাদ</th><td className="py-1.5 text-right font-semibold">{bn(r.guessing.elimBoth)}বার <span className="font-normal text-muted">(সঠিক উত্তর বাদ পড়েছে {bn(r.guessing.elimLost)}বার)</span></td></tr>
                  </tbody>
                </table>
                <p className={`mt-3 rounded-lg px-3 py-2 text-[15px] ${r.guessing.net >= 0 ? "bg-green-wash" : "bg-danger-wash"}`}>
                  {r.guessing.net >= 0 ? "✓ Guessing লাভজনক হয়েছে।" : "! Guessing-এ নম্বর হারিয়েছেন।"}
                  {r.guessing.elimLost > 0 && ` ${bn(r.guessing.elimLost)}বার সঠিক উত্তরটিই বাদ দিয়েছেন — বাদ দেওয়ার আগে আরেকবার যাচাই করুন।`}
                </p>
              </>
            ) : <p className="text-[15px] text-ink-2">এই পরীক্ষায় কোনো প্রশ্নে Guess করা হয়নি।</p>}
        </Card>
      </div>

      {/* ── অন্তর্দৃষ্টি + করণীয় */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card id="ins-h" title="মূল অন্তর্দৃষ্টি">
          <ul className="grid gap-2 text-[15px]">
            {r.insights.map((x) => <li key={x} className="flex gap-2"><span aria-hidden="true" className="text-green">●</span><span>{x}</span></li>)}
          </ul>
        </Card>
        <Card id="act-h" title="পরবর্তী পরীক্ষার জন্য করণীয়">
          {r.actions.length ? (
            <ol className="grid gap-3">
              {r.actions.map((a, i) => (
                <li key={a.action} className="flex gap-3">
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-green font-bold text-white dark:text-paper">{bn(i + 1)}</span>
                  <div>
                    <p className="text-[15px] font-semibold">{a.action}</p>
                    <p className="text-sm text-ink-2"><span className="sr-only">কারণ: </span><span aria-hidden="true">কারণ → </span>{a.weakness}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="text-[15px] text-ink-2">এই পরীক্ষায় মানদণ্ডের নিচে কোনো দুর্বলতা পাওয়া যায়নি — একই ধারা বজায় রাখুন।</p>}
        </Card>
      </div>

      {/* ── আগের পরীক্ষার সঙ্গে তুলনা */}
      {r.previous ? (
        <Card id="prev-h" title={`আগের ${r.kindLabel}-এর সঙ্গে তুলনা`} className="mt-5" aside={<Link href={`/performance/${r.previous.id}`} className="text-sm font-semibold text-green underline-offset-4 hover:underline">{r.previous.title}</Link>}>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "নেট (২০০-এ)", v: signed(r.previous.deltaNet200), up: r.previous.deltaNet200 >= 0 },
              { k: "Accuracy", v: r.previous.deltaAccuracy == null ? "—" : `${signed(r.previous.deltaAccuracy)}%`, up: (r.previous.deltaAccuracy ?? 0) >= 0 },
              { k: "Attempt", v: `${signed(r.previous.deltaAttempt)}%`, up: null },
              { k: "সময়ের ব্যবহার", v: r.previous.deltaUtilization == null ? "—" : `${signed(r.previous.deltaUtilization, 0)}%`, up: null },
            ].map((x) => (
              <div key={x.k} className="rounded-lg bg-paper px-3 py-2">
                <dt className="text-sm text-muted">{x.k}</dt>
                <dd className={`text-xl font-bold tabular ${x.up == null ? "" : x.up ? "text-green" : "text-danger"}`}>{x.up == null ? "" : x.up ? "▲ " : "▼ "}{x.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-ink-2">
            {r.previous.subjectDelta.some((x) => x.delta != null)
              ? <>বিষয়ভিত্তিক নেট-হারের পার্থক্য (%): {r.previous.subjectDelta.filter((x) => x.delta != null).map((x) => `${x.name} ${signed(x.delta!)}`).join(" · ")}</>
              : "বিষয়ভিত্তিক তুলনা দেখানো হচ্ছে না — কোনো বিষয়ে দুই পরীক্ষাতেই অন্তত ৫টি প্রশ্ন নেই।"}
          </p>
          <p className="mt-2 text-xs text-muted">এটি শুধু দুটি পরীক্ষার পার্থক্য — উন্নতির প্রবণতা নয়। প্রবণতা দেখুন <Link href="/performance" className="text-green underline">Performance Dashboard</Link>-এ।</p>
        </Card>
      ) : (
        <p className="mt-5 text-sm text-muted">এটি আপনার প্রথম সম্পন্ন {r.kindLabel} — একই ধরনের আগের পরীক্ষা নেই, তাই তুলনা দেখানো হচ্ছে না।</p>
      )}
    </>
  );
}
