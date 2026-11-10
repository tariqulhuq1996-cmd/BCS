import { prisma } from "@/lib/db";

/**
 * Uptime-পর্যবেক্ষণের জন্য: অ্যাপ ও ডেটাবেস চালু আছে কি না। কোনো ব্যক্তিগত তথ্য দেয় না।
 * ঠিক থাকলে ২০০, ডেটাবেস না পেলে ৫০৩।
 */
export async function GET() {
  const t = Date.now();
  try {
    await prisma.$queryRaw`select 1`;
    return Response.json({ ok: true, db: "ok", ms: Date.now() - t }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
