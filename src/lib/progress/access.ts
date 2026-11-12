import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getStudentTasks, pickCurrent, type TaskView } from "./dashboard";

/**
 * ধাপ-পাতার জন্য: লগইন যাচাই, কাজ খোঁজা এবং শিক্ষার্থীর প্রবেশাধিকার (সার্ভার-সাইড)।
 * URL বদলে তালাবন্ধ ধাপে ঢুকলে `locked: true` ফেরে — পাতা তখন কোনো বিষয়বস্তু দেখায় না।
 */
export async function loadTaskForPage(key: string, path: string): Promise<{ task: TaskView; locked: boolean; current: TaskView | null; all: TaskView[] }> {
  const user = await requireUser(path);
  const all = await getStudentTasks(user.id);
  const task = all.find((t) => t.key === key);
  if (!task) notFound();
  return { task, locked: task.state === "LOCKED", current: pickCurrent(all), all };
}

/**
 * যাত্রার পাশের অংশ (যেমন সাম্প্রতিক বিষয়াবলি) খোলা কি না: সংশ্লিষ্ট কাজটি LOCKED না হলেই খোলা। অ্যাডমিনের জন্য সবসময় খোলা।
 * ফেরত: তালাবন্ধ হলে বর্তমান কাজ (কোথায় যেতে হবে), নইলে null।
 */
export async function lockedBy(user: { id: string; role: string }, key: string): Promise<{ current: TaskView | null; title: string } | null> {
  if (user.role === "ADMIN") return null;
  const all = await getStudentTasks(user.id);
  const t = all.find((x) => x.key === key);
  if (!t || t.state !== "LOCKED") return null;
  return { current: pickCurrent(all), title: t.title };
}
