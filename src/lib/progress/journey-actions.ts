"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { orientationStatus, setOrientItem } from "./journey";

/** প্রশ্ন-বিশ্লেষণের একটি অংশে "পড়েছি" দেওয়া/তুলে নেওয়া। ফেরত: কতটি অংশ পড়া হয়েছে, ধাপ ০-এর প্রথম অংশ শেষ কি না। */
export async function setOrientAction(item: string, on: boolean): Promise<{ checked: string[]; done: boolean } | null> {
  const user = await getCurrentUser();
  if (!user || typeof item !== "string" || item.length > 20) return null;
  try {
    await setOrientItem(prisma, user.id, item, !!on);
  } catch {
    return null;
  }
  return orientationStatus(prisma, user.id);
}
