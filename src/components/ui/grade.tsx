/** Priority শ্রেণি-ব্যাজ: A গাঢ়তম, D হালকাতম — একটি রঙের ক্রমিক ধাপ, সঙ্গে অক্ষর (শুধু রঙে অর্থ নয়)। */
const STYLE: Record<string, string> = {
  A: "bg-green text-white dark:text-paper border-green",
  B: "bg-green-wash text-green-strong border-green",
  C: "bg-surface text-ink-2 border-line-strong",
  D: "bg-paper text-muted border-line",
};

export function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null;
  return (
    <span
      title={`Priority ${grade}`}
      className={`inline-grid h-6 min-w-6 place-items-center rounded-full border px-1.5 text-xs font-bold leading-none ${STYLE[grade] ?? STYLE.D}`}
    >
      {grade}
    </span>
  );
}
