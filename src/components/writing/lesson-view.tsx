import type { ReactNode } from "react";
import { bn } from "@/lib/bn";
import type { Lesson } from "@/lib/writing/lesson";
import { AssignmentBox } from "./assignment-box";

/** Daily English Writing Practice ধাঁচের সাজানো পাঠ — অংশগুলো ক্রমানুসারে নম্বরসহ। */
export function LessonView({ lesson: l, code }: { lesson: Lesson; code: string }) {
  let n = 0;
  const sec = (title: string, body: ReactNode, sub?: string) => {
    n++;
    return (
      <section key={title} id={`part-${n}`} aria-labelledby={`sec-${n}`} className="scroll-mt-28 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id={`sec-${n}`} className="text-xl font-bold">
          <span className="text-green">{bn(n)}.</span> {title}
        </h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        <div className="mt-4">{body}</div>
      </section>
    );
  };
  const parts: ReactNode[] = [];

  if (l.paragraph) {
    const p = l.paragraph;
    parts.push(sec("English Paragraph", (
      <>
        <h3 className="text-lg font-semibold">{p.title}</h3>
        <p className="mt-1 flex flex-wrap gap-2 text-sm">
          {p.words && <Chip>{bn(p.words)} words</Chip>}
          {p.pattern && <Chip>{p.pattern}</Chip>}
        </p>
        <p lang="en" className="mt-4 rounded-xl bg-paper p-4 text-[17px] leading-8">{p.text}</p>
        {p.note && <p className="mt-3 text-[15px] text-ink-2">{p.note}</p>}
        {p.sources?.length ? <Sources list={p.sources} /> : null}
        {l.structure?.length ? (
          <>
            <h3 className="mt-6 font-semibold">Paragraph-এর Writing Structure</h3>
            <Table head={["ধাপ", "কী লিখবে"]} rows={l.structure.map((s) => [<b key="s" lang="en">{s.step}</b>, s.what])} />
          </>
        ) : null}
      </>
    )));
  }

  if (l.vocabulary?.length) {
    parts.push(sec(`${bn(l.vocabulary.length)}টি Important Vocabulary`, (
      <>
        <Table head={["Word", "বাংলা অর্থ", "Parts of Speech"]} rows={l.vocabulary.map((v) => [<b key="w" lang="en">{v.word}</b>, v.bn, v.pos])} />
        <h3 className="mt-6 font-semibold">ব্যবহার ও উদাহরণ</h3>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2">
          {l.vocabulary.map((v, i) => (
            <li key={v.word} className="rounded-xl border border-line p-4">
              <p className="font-semibold"><span className="text-muted">{bn(i + 1)}.</span> <span lang="en">{v.word}</span></p>
              <p className="mt-1 text-sm text-ink-2" lang="en">
                {v.synonym && <>Synonym: <b>{v.synonym}</b></>}{v.synonym && v.antonym && " · "}{v.antonym && <>Antonym: <b>{v.antonym}</b></>}
              </p>
              <p className="mt-2 italic" lang="en">{v.example}</p>
              <p className="mt-1 text-[15px] text-ink-2">অর্থ: {v.exampleBn}</p>
            </li>
          ))}
        </ol>
      </>
    )));
  }

  if (l.prepositional?.length) {
    parts.push(sec(`${bn(l.prepositional.length)}টি Prepositional Phrases`, (
      <>
        <Table head={["Phrase", "বাংলা অর্থ"]} rows={l.prepositional.map((p) => [<b key="p" lang="en">{p.phrase}</b>, p.bn])} />
        <h3 className="mt-6 font-semibold">ব্যবহার</h3>
        <ol className="mt-3 space-y-3">
          {l.prepositional.map((p, i) => (
            <li key={p.phrase}>
              <p lang="en"><span className="text-muted">{i + 1}.</span> {p.example}</p>
              <p className="text-[15px] text-ink-2">{p.exampleBn}</p>
            </li>
          ))}
        </ol>
      </>
    )));
  }

  if (l.idioms?.items.length) {
    parts.push(sec(`${bn(l.idioms.items.length)}টি Idioms and Phrases`, (
      <>
        <Table head={["Idiom/Phrase", "বাংলা অর্থ"]} rows={l.idioms.items.map((x) => [<b key="i" lang="en">{x.phrase}</b>, x.bn])} />
        <h3 className="mt-6 font-semibold">Examples</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-6" lang="en">{l.idioms.items.map((x) => <li key={x.phrase}>{x.example}</li>)}</ul>
        {l.idioms.tip && <Tip label="পরীক্ষার টিপস">{l.idioms.tip}</Tip>}
      </>
    )));
  }

  if (l.writers?.items.length) {
    const w = l.writers;
    parts.push(sec("Famous Writers and Literary Analysis", (
      <>
        {w.intro && <p className="text-ink-2">{w.intro}</p>}
        <div className="mt-4 grid gap-5">
          {w.items.map((x, i) => (
            <article key={x.name} className="overflow-hidden rounded-xl border border-line">
              <header className="bg-paper px-4 py-3">
                <p className="text-sm text-muted">Writer {String(i + 1).padStart(2, "0")}</p>
                <h3 className="text-lg font-bold" lang="en">{x.name}</h3>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-2" lang="en">
                  <Info k="Nationality" v={x.nationality} /><Info k="Literary identity" v={x.identity} />
                  <Info k="Selected Book" v={x.book} /><Info k="Published" v={x.published} /><Info k="Genre" v={x.genre} />
                </dl>
              </header>
              <div className="space-y-4 p-4">
                <div><h4 className="font-semibold">A. বইটির সংক্ষিপ্ত Summary</h4><p className="mt-1 leading-7">{x.summary}</p></div>
                <div>
                  <h4 className="font-semibold">B. গুরুত্বপূর্ণ চরিত্র</h4>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                    {x.characters.map((c) => (
                      <li key={c.name} className="rounded-lg bg-paper p-3"><p className="font-semibold" lang="en">{c.name}</p><p className="mt-1 text-[15px] text-ink-2">{c.desc}</p></li>
                    ))}
                  </ul>
                </div>
                <div><h4 className="font-semibold">C. লেখকের মূল বক্তব্য ও দৃষ্টিভঙ্গি</h4>{x.message.map((m) => <p key={m} className="mt-1 leading-7">{m}</p>)}{x.sources?.length ? <Sources list={x.sources} /> : null}</div>
                <div><h4 className="font-semibold">BCS Written-এ প্রয়োগ</h4><p className="mt-2 flex flex-wrap gap-2" lang="en">{x.bcsUse.map((u) => <Chip key={u}>{u}</Chip>)}</p></div>
              </div>
            </article>
          ))}
        </div>
        {w.takeaway?.length ? (
          <div className="mt-5 rounded-xl bg-green-wash p-4">
            <h3 className="font-semibold">দুটি বই থেকে যে বিষয়টি শিখবে</h3>
            {w.takeaway.map((t) => <p key={t} className="mt-1.5">{t}</p>)}
          </div>
        ) : null}
      </>
    )));
  }

  if (l.quote) {
    const q = l.quote;
    parts.push(sec("One Famous Quote", (
      <>
        <blockquote className="rounded-xl border-l-4 border-green bg-paper p-5">
          <p className="text-2xl font-semibold leading-snug" lang="en">“{q.text}”</p>
          <footer className="mt-2 text-ink-2" lang="en">— {q.author}{q.work ? `, ${q.work}` : ""}</footer>
        </blockquote>
        <p className="mt-4"><b>বাংলা অর্থ:</b> {q.bn}</p>
        <p className="mt-2"><b>ব্যাখ্যা:</b> {q.explanation}</p>
        <p className="mt-3 font-semibold">যেসব Essay-তে ব্যবহার করবে</p>
        <p className="mt-2 flex flex-wrap gap-2" lang="en">{q.useIn.map((u) => <Chip key={u}>{u}</Chip>)}</p>
      </>
    )));
  }

  if (l.sentences?.length) {
    parts.push(sec("Paragraph-এর বাক্যভিত্তিক বাংলা ব্যাখ্যা", (
      <ol className="space-y-4">
        {l.sentences.map((s, i) => (
          <li key={i} className="rounded-xl border border-line p-4">
            <p className="text-sm font-semibold text-muted">Sentence {i + 1}</p>
            <p className="mt-1 font-medium" lang="en">{s.en}</p>
            <p className="mt-2"><b>বাংলা:</b> {s.bn}</p>
            {s.notes?.length ? <ul className="mt-2 list-disc space-y-1 pl-6 text-[15px] text-ink-2">{s.notes.map((x) => <li key={x}>{x}</li>)}</ul> : null}
          </li>
        ))}
      </ol>
    )));
  }

  if (l.wordChoice?.items.length) {
    const wc = l.wordChoice;
    parts.push(sec("Right Word Selection and Better Expression", (
      <>
        <div className="grid gap-4 lg:grid-cols-2">
          {wc.items.map((x, i) => (
            <div key={x.title} className="rounded-xl border border-line p-4">
              <h3 className="font-semibold"><span className="text-muted">{bn(i + 1)}.</span> <span lang="en">{x.title}</span></h3>
              {x.note && <p className="mt-1 text-[15px] text-danger">{x.note}</p>}
              <Table head={["Word", "অর্থ ও ব্যবহার"]} rows={x.rows.map((r) => [<b key="w" lang="en">{r.word}</b>, r.meaning])} />
              <ul className="mt-3 list-disc space-y-1 pl-6 text-[15px] italic" lang="en">{x.examples.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          ))}
        </div>
        {wc.tip && <Tip label="মনে রাখবে">{wc.tip}</Tip>}
      </>
    ), "আজ পাঁচটি গুরুত্বপূর্ণ Word Comparison শিখবে।"));
  }

  if (l.grammar?.length) {
    parts.push(sec("Grammar Focus", (
      <div className="grid gap-4">
        {l.grammar.map((g, i) => (
          <div key={g.title} className="rounded-xl border border-line p-4">
            <h3 className="font-semibold">Rule {i + 1}: <span lang="en">{g.title}</span></h3>
            <p className="mt-2"><b>Structure:</b> <code lang="en" className="rounded bg-paper px-1.5 py-0.5">{g.structure}</code></p>
            <p className="mt-2" lang="en"><b>Example:</b> {g.example}</p>
            <p className="mt-2"><b>ব্যাখ্যা:</b> {g.explanation}</p>
            {g.wrong && <p className="mt-2 text-danger" lang="en"><b>✗ সাধারণ ভুল:</b> {g.wrong}</p>}
            {g.right && <p className="mt-1 text-green" lang="en"><b>✓ সঠিক:</b> {g.right}</p>}
            {g.note && <p className="mt-2 text-[15px] text-ink-2">{g.note}</p>}
            {g.more?.length ? <ul className="mt-2 list-disc space-y-1 pl-6 italic" lang="en">{g.more.map((m) => <li key={m}>{m}</li>)}</ul> : null}
          </div>
        ))}
      </div>
    )));
  }

  if (l.collocations?.length || l.connectors?.length) {
    parts.push(sec("Collocations and Connectors", (
      <div className="grid gap-6 lg:grid-cols-2">
        {l.collocations?.length ? <div><h3 className="font-semibold">Important Collocations</h3><Table head={["Expression", "বাংলা অর্থ"]} rows={l.collocations.map((c) => [<b key="c" lang="en">{c.expr}</b>, c.bn])} /></div> : null}
        {l.connectors?.length ? <div><h3 className="font-semibold">Connectors</h3><Table head={["Connector", "বাংলা অর্থ", "ব্যবহার"]} rows={l.connectors.map((c) => [<b key="c" lang="en">{c.word}</b>, c.bn, c.use])} /></div> : null}
      </div>
    )));
  }

  if (l.transformation?.length) {
    parts.push(sec("Sentence Transformation", (
      <>
        <ol className="space-y-3">
          {l.transformation.map((t) => (
            <li key={t.label} className="rounded-xl bg-paper p-4">
              <p className="text-sm font-semibold text-muted">{t.label}</p>
              <p className="mt-1 text-[17px]" lang="en">{t.text}</p>
            </li>
          ))}
        </ol>
        {l.transformationNote && <Tip label="শেখার বিষয়">{l.transformationNote}</Tip>}
      </>
    )));
  }

  if (l.translation) {
    const t = l.translation;
    const block = (title: string, list: { q: string; a: string }[], start: number, enQ: boolean) => (
      <div>
        <h3 className="font-semibold">{title}</h3>
        <ol className="mt-2 space-y-3">
          {list.map((x, i) => (
            <li key={x.q} className="rounded-xl border border-line p-4">
              <p lang={enQ ? "en" : undefined}><span className="text-muted">{bn(start + i)}.</span> {x.q}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-[15px] font-semibold text-green">উত্তর দেখো</summary>
                <p className="mt-2 rounded-lg bg-green-wash px-3 py-2" lang={enQ ? undefined : "en"}>{x.a}</p>
              </details>
            </li>
          ))}
        </ol>
      </div>
    );
    parts.push(sec("Translation Practice", (
      <div className="grid gap-5">
        {block("A. বাংলা থেকে ইংরেজি", t.bnToEn, 1, false)}
        {block("B. ইংরেজি থেকে বাংলা", t.enToBn, t.bnToEn.length + 1, true)}
      </div>
    ), t.note));
  }

  if (l.assignment) {
    const a = l.assignment;
    parts.push(sec("Daily Writing Assignment", (
      <>
        <p>{a.intro}</p>
        <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2" lang="en">
          {a.expressions.map((e, i) => <li key={e}><span className="text-muted">{i + 1}.</span> {e}</li>)}
        </ol>
        <p className="mt-4 font-semibold">মূল্যায়নের মানদণ্ড</p>
        <p className="mt-2 flex flex-wrap gap-2" lang="en">{a.criteria.map((c) => <Chip key={c}>{c}</Chip>)}</p>
        {a.note && <p className="mt-4 text-[15px] text-ink-2">{a.note}</p>}
        <AssignmentBox storageKey={`writing-assignment:${code}`} />
      </>
    ), "আজকের ৫টি Sentence Challenge"));
  }

  return (
    <div className="mt-6 grid gap-5">
      {(l.intro?.length || l.topic) && (
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <p className="text-sm font-semibold text-muted">আজকের বিষয়</p>
          <p className="mt-1 text-xl font-bold" lang="en">{l.topic}</p>
          {l.intro?.map((x) => <p key={x} className="mt-2 text-ink-2">{x}</p>)}
        </section>
      )}
      {parts}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-full bg-green-wash px-3 py-1 text-sm font-medium text-ink">{children}</span>;
}
function Info({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><dt className="text-muted">{k}:</dt><dd className="font-medium">{v}</dd></div>;
}
function Tip({ label, children }: { label: string; children: ReactNode }) {
  return <p className="mt-4 rounded-lg bg-omr-wash px-4 py-3 text-[15px]"><b>{label}:</b> {children}</p>;
}
function Sources({ list }: { list: string[] }) {
  return <p className="mt-2 text-xs text-muted">তথ্যসূত্র: {list.join("; ")}</p>;
}
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[20rem] border-collapse text-left text-[15px]">
        <thead><tr>{head.map((h) => <th key={h} className="border-b-2 border-line-strong px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line">{r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
