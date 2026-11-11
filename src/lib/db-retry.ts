/**
 * একই সারিতে একসঙ্গে লেখার সংঘাতে আবার চেষ্টা। MariaDB 11.8 (innodb_snapshot_isolation) একযোগে হালনাগাদে
 * 1020 "Record has changed since last read" দেয়; deadlock-এ 1213; Prisma-তে P2034 (write conflict)।
 * upsert-এর দৌড়ে (দুজনেই "নেই" দেখে create) P2002 — আবার চেষ্টায় update পথে যায়।
 */
export function isRetryableWrite(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "P2034" || err.code === "P2002") return true;
  return /\b(1020|1213|1205)\b|Record has changed since last read|Deadlock found/.test(err.message ?? "");
}

export async function withWriteRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries || !isRetryableWrite(e)) throw e;
      await new Promise((r) => setTimeout(r, 15 * i + Math.random() * 25));
    }
  }
}
