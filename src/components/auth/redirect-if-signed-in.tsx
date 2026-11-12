import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getPendingUser } from "@/lib/auth/session";

/**
 * লগইন বা অ্যাকাউন্ট-খোলার ফর্ম শুধু লগইন ছাড়া ব্যবহারকারীর জন্য। লগইন করা থাকলে ফর্ম একবারও না দেখিয়ে
 * Dashboard-এ (ইমেইল যাচাই বাকি থাকলে যাচাই-পাতায়) পাঠানো হয়।
 */
export async function SignedOutOnly({ children }: { children: ReactNode }) {
  if (await getCurrentUser()) redirect("/dashboard");
  if (await getPendingUser()) redirect("/verify-email");
  return children;
}
