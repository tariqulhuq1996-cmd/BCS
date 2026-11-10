import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { fullBackup, progressCsv, questionsCsv, questionsJson } from "@/lib/admin/export";

const KINDS: Record<string, { type: string; make: () => Promise<string> }> = {
  "questions.csv": { type: "text/csv; charset=utf-8", make: () => questionsCsv(prisma) },
  "questions.json": { type: "application/json; charset=utf-8", make: () => questionsJson(prisma) },
  "progress.csv": { type: "text/csv; charset=utf-8", make: () => progressCsv(prisma) },
  "backup.json": { type: "application/json; charset=utf-8", make: () => fullBackup(prisma) },
};

/** অ্যাডমিনের জন্য ডাউনলোড; অন্য কেউ চাইলে ৪০৪। প্রতিটি ডাউনলোড Audit Log-এ থাকে। */
export async function GET(_req: Request, ctx: RouteContext<"/admin/export/[kind]">) {
  const { kind } = await ctx.params;
  const u = await getCurrentUser();
  if (!u || u.role !== "ADMIN" || !KINDS[kind]) return new Response("Not found", { status: 404 });
  const body = await KINDS[kind].make();
  await prisma.auditLog.create({ data: { actorId: u.id, action: "export", entity: "Export", entityId: kind } });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": KINDS[kind].type,
      "Content-Disposition": `attachment; filename="bcs52-${stamp}-${kind}"`,
      "Cache-Control": "no-store",
    },
  });
}
