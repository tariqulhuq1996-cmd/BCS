import Link from "next/link";
import { Icon } from "./icons";

/** পাতার ওপরে "ফিরে যান" লিংক — আগের (মূল) পাতায় ফেরার জন্য সব পাতায় একই রূপ। */
export function BackLink({ href, label, className = "mb-4" }: { href: string; label: string; className?: string }) {
  return (
    <p className={className}>
      <Link href={href} className="inline-flex items-center gap-1 text-[15px] font-semibold text-green underline-offset-4 hover:underline">
        <Icon name="chevron" className="size-4 rotate-90" aria-hidden />
        <span className="sr-only">ফিরে যান: </span>
        {label}
      </Link>
    </p>
  );
}
