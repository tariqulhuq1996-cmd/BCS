/**
 * কাঁচা SQL-এর ফলাফলে সংখ্যা স্বাভাবিক করা: MariaDB/MySQL-এ count() BigInt আর sum() Decimal ফেরত দেয়।
 * প্রতিটি সারির BigInt/Decimal মানকে সাধারণ number বানায় (লেখা ও তারিখ অপরিবর্তিত)।
 */
export function numify<T extends unknown[]>(rows: T): T {
  return (rows as Record<string, unknown>[]).map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "bigint") o[k] = Number(v);
      else if (v !== null && typeof v === "object" && !(v instanceof Date) && typeof (v as { toNumber?: unknown }).toNumber === "function")
        o[k] = (v as { toNumber: () => number }).toNumber();
      else o[k] = v;
    }
    return o;
  }) as T;
}
