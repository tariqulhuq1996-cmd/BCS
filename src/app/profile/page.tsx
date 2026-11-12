import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { bn } from "@/lib/bn";
import { PasswordForm, ProfileForm } from "@/components/portal/profile-forms";

export const metadata: Metadata = { title: "প্রোফাইল" };

export default function ProfilePage() {
  return (
    <section className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>প্রোফাইল</h1>
      <Suspense fallback={<p className="mt-6 text-ink-2">লোড হচ্ছে…</p>}>
        <Content />
      </Suspense>
    </section>
  );
}

async function Content() {
  const user = await requireUser("/profile");
  const [p, u] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: user.id } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true } }),
  ]);
  const joined = u.createdAt.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
  return (
    <>
      <p className="mt-2 text-ink-2">
        {user.email}। অ্যাকাউন্ট খোলা হয়েছে {joined}। লক্ষ্য: {bn(p?.targetBcs ?? 52)}তম BCS Preliminary।
      </p>
      <div className="mt-10 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold">ব্যক্তিগত তথ্য</h2>
          <div className="mt-5">
            <ProfileForm initial={{ name: p?.name ?? "", phone: p?.phone ?? "", dailyGoalMin: String(p?.dailyGoalMin ?? 120) }} />
          </div>
        </div>
        <div id="password" className="scroll-mt-24">
          <h2 className="text-xl font-bold">পাসওয়ার্ড বদলান</h2>
          <div className="mt-5">
            <PasswordForm />
          </div>
        </div>
      </div>
    </>
  );
}
