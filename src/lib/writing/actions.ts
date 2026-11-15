"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { markRead } from "./service";

/** "পড়া শেষ" — কার্ডটি পড়া হয়েছে চিহ্নিত করে পরের কার্ডে নিয়ে যায় (শেষ কার্ড হলে তালিকায়)। */
export async function markCardRead(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  if (!/^[A-Z]{2}-\d{3}$/.test(code)) redirect("/writing");
  const user = await requireUser(`/writing/${code}`);
  const r = await markRead(prisma, user.id, code, user.role === "ADMIN");
  revalidatePath("/writing", "layout");
  if (!r.ok) redirect(`/writing/${code}`);
  redirect(r.next ? `/writing/${r.next}` : `/writing?s=${code.slice(0, 2)}&done=1`);
}
