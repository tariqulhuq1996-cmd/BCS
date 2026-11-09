/**
 * অ্যাডমিন অ্যাকাউন্ট তৈরি বা কোনো অ্যাকাউন্টকে অ্যাডমিন করা।
 *   npx tsx scripts/create-admin.ts <ইমেইল> <পাসওয়ার্ড (৮+ অক্ষর)> [নাম]
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const [email, password, name = "অ্যাডমিন"] = process.argv.slice(2);

async function main() {
  if (!email || !password || password.length < 8) {
    console.error("ব্যবহার: npx tsx scripts/create-admin.ts <ইমেইল> <পাসওয়ার্ড (৮+ অক্ষর)> [নাম]");
    process.exit(1);
  }
  const e = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const u = await prisma.user.upsert({
    where: { email: e },
    update: { role: "ADMIN", passwordHash },
    create: { email: e, role: "ADMIN", passwordHash, profile: { create: { name } } },
  });
  console.log(`অ্যাডমিন প্রস্তুত: ${u.email}`);
}

main().finally(() => prisma.$disconnect());
