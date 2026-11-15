import Link from "next/link";
import { Icon } from "@/components/site/icons";
import { bn } from "@/lib/bn";
import type { CardSummary } from "@/lib/writing/service";

/** তথ্য-কার্ডের টাইল: ওপরে রঙিন ব্যান্ড, নিচে অংশ, শিরোনাম ও পড়ার লিংক (খোলা/পড়া/লক)। */
export function CardTile({ card, band, short }: { card: CardSummary; band: string; short: string }) {
  const locked = card.state === "locked";
  return (
    <li className={`flex flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(20,20,60,0.08)] ring-1 ring-line ${locked ? "opacity-80" : ""}`}>
      <div className={`relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br ${band} ${locked ? "grayscale-[60%]" : ""}`}>
        {/* পটভূমির তির্যক আকৃতি */}
        <span aria-hidden className="absolute -left-10 -top-16 size-48 rotate-[28deg] rounded-[2.5rem] bg-white/8" />
        <span aria-hidden className="absolute -bottom-20 right-[-3rem] size-56 rotate-[-18deg] rounded-[3rem] bg-white/10" />
        <div className="relative text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/80">{short}</p>
          <p className="font-display text-4xl font-extrabold leading-tight tabular" style={{ fontStretch: "110%" }}>কার্ড {bn(card.order)}</p>
        </div>
        {locked && (
          <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/25 text-white" title="লক">
            <Icon name="lock" className="size-5" />
          </span>
        )}
        {card.state === "read" && (
          <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white text-green" title="পড়া হয়েছে">
            <Icon name="check" className="size-5" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm text-muted">{card.section}{card.paper && card.paper !== "—" ? ` · ${card.paper}` : ""}</p>
        <h3 className="mt-2.5 text-[17px] font-medium leading-snug text-ink">{card.title}</h3>
        <div className="mt-auto pt-6">
          {locked ? (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Icon name="lock" className="size-4" /> আগের কার্ড শেষ করলে খুলবে
            </p>
          ) : (
            <Link href={`/writing/${card.code}`} className="inline-flex items-center gap-1 text-[15px] font-bold text-[#1d4ed8] hover:underline dark:text-[#7ea8ff]">
              {card.state === "read" ? "আবার পড়ুন" : "কার্ড পড়ুন"}
              <Icon name="chevron" className="size-4 -rotate-90" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
