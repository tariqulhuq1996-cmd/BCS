"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export type MenuItem = { href: string; label: string; icon: IconName; tone?: "green" | "omr" | "plain"; note?: string };

const TONE = {
  green: "bg-green-wash text-green",
  omr: "bg-omr-wash text-omr",
  plain: "bg-paper text-ink-2",
} as const;

/** এই লিংকের পাতাতেই আছেন কি না (Dashboard-এর নিচের পাতাও Dashboard ধরা হয়)। */
function useActive(href: string) {
  const path = usePathname();
  const base = href.split("#")[0];
  return base === "/" ? path === "/" : path === base || path.startsWith(base + "/");
}

/** header-এর আইকনসহ লিংক; যে পাতায় আছেন সেটি হালকা সবুজে চিহ্নিত। */
export function NavLink({ href, label, icon, compact = false }: { href: string; label: string; icon: IconName; compact?: boolean }) {
  const active = useActive(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium ${compact ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-[15px]"} ${
        active ? "bg-green-wash text-green" : "text-ink-2 hover:bg-paper hover:text-ink"
      }`}
    >
      <Icon name={icon} width={compact ? 17 : 19} height={compact ? 17 : 19} />
      {label}
    </Link>
  );
}

/** খোলা/বন্ধ — বাইরে ক্লিক, Esc বা অন্য পাতায় গেলে বন্ধ; Esc-এ ফোকাস বোতামে ফেরে। */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  // অন্য পাতায় গেলে বন্ধ (রেন্ডারের সময়ই — effect-এ setState নয়)
  const path = usePathname();
  const [seenPath, setSeenPath] = useState(path);
  if (path !== seenPath) {
    setSeenPath(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  // কিবোর্ডে Tab দিয়ে মেনুর বাইরে গেলে বন্ধ
  const onBlur = (e: React.FocusEvent) => !box.current?.contains(e.relatedTarget as Node) && setOpen(false);
  return { open, setOpen, box, btn, onBlur };
}

function ItemLink({ item, onPick }: { item: MenuItem; onPick: () => void }) {
  const active = useActive(item.href);
  return (
    <Link
      href={item.href}
      onClick={onPick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-[15px] hover:bg-paper ${active ? "font-semibold text-green" : "text-ink"}`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${TONE[item.tone ?? "plain"]}`}>
        <Icon name={item.icon} />
      </span>
      <span className="min-w-0">
        <span className="block">{item.label}</span>
        {item.note && <span className="block text-[13px] font-normal text-muted">{item.note}</span>}
      </span>
    </Link>
  );
}

/** "এক্সপ্লোর" — সাধারণ পাতাগুলো এক জায়গায়। */
export function ExploreMenu({ items }: { items: MenuItem[] }) {
  const { open, setOpen, box, btn, onBlur } = useDisclosure();
  const id = useId();
  const path = usePathname();
  const inside = items.some((i) => path === i.href.split("#")[0] && i.href.split("#")[0] !== "/");
  return (
    <div ref={box} className="relative" onBlur={onBlur}>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[15px] font-medium ${inside || open ? "bg-green-wash text-green" : "text-ink-2 hover:bg-paper hover:text-ink"}`}
      >
        <Icon name="compass" width={19} height={19} />
        এক্সপ্লোর
        <Icon name="chevron" width={16} height={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={id} hidden={!open} className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-line bg-surface p-2 shadow-lg">
        <ul className="grid gap-0.5">
          {items.map((i) => (
            <li key={i.href}>
              <ItemLink item={i} onPick={() => setOpen(false)} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** নাম-ছবিসহ অ্যাকাউন্ট-মেনু (দুই কলাম; মোবাইলে এক কলাম)। লগআউট ফর্মটি সার্ভার থেকে আসে। */
export function UserMenu({ name, email, left, right, logout }: { name: string; email: string; left: MenuItem[]; right: MenuItem[]; logout: ReactNode }) {
  const { open, setOpen, box, btn, onBlur } = useDisclosure();
  const id = useId();
  const initial = [...name.trim()][0]?.toUpperCase() ?? "?";
  const first = name.trim().split(/\s+/)[0] ?? name;
  return (
    <div ref={box} className="relative" onBlur={onBlur}>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`অ্যাকাউন্ট-মেনু: ${name}`}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-1 sm:pr-2.5 ${open ? "bg-green-wash" : "hover:bg-paper"}`}
      >
        <span className="grid size-8 place-items-center rounded-full bg-green font-semibold text-white dark:text-paper">{initial}</span>
        <span className="hidden max-w-[9rem] truncate text-[15px] font-medium text-ink sm:block">{first}</span>
        <Icon name="chevron" width={16} height={16} className={`hidden text-ink-2 transition-transform sm:block ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id={id}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface shadow-lg"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-green text-lg font-semibold text-white dark:text-paper">{initial}</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{name}</span>
            <span className="block truncate text-sm text-muted">{email}</span>
          </span>
        </div>
        <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-line">
          <ul className="grid content-start gap-0.5 p-2">
            {left.map((i) => (
              <li key={i.href}>
                <ItemLink item={i} onPick={() => setOpen(false)} />
              </li>
            ))}
          </ul>
          <div className="flex flex-col border-t border-line p-2 sm:border-t-0">
            <ul className="grid content-start gap-0.5">
              {right.map((i) => (
                <li key={i.href}>
                  <ItemLink item={i} onPick={() => setOpen(false)} />
                </li>
              ))}
            </ul>
            <div className="mt-auto border-t border-line pt-1.5 sm:mt-4">{logout}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
