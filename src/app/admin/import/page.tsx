import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { AdminTitle } from "@/components/admin/ui";
import { ImportForm } from "@/components/admin/import-form";

export const metadata: Metadata = { title: "Import — অ্যাডমিন", robots: { index: false } };

export default function ImportPage() {
  return (
    <>
      <AdminTitle
        title="প্রশ্ন Import"
        lead="Level ২-এর প্রশ্নভান্ডার CSV, JSON বা Excel ফাইল থেকে। প্রতিটি সারি যাচাই হয়; হুবহু পুনরাবৃত্তি বাদ পড়ে, প্রায়-একই প্রশ্ন খসড়া হিসেবে আসে।"
      />
      <Suspense fallback={null}>
        <Guard />
      </Suspense>
      <section className="mt-10 max-w-3xl text-[15px] text-ink-2">
        <h2 className="text-lg font-bold text-ink">কলামের নাম</h2>
        <p className="mt-2">
          <code>subtopic_code, question, option_a, option_b, option_c, option_d, answer, explanation, difficulty, source, question_type</code>। উত্তর: ক/খ/গ/ঘ, A–D, ১–৪
          অথবা সঠিক অপশনের লেখা। কঠিনতা: easy/medium/hard বা সহজ/মাঝারি/কঠিন। বিস্তারিত: <code>docs/QUESTION_IMPORT.md</code>।
        </p>
      </section>
    </>
  );
}

async function Guard() {
  await requireAdmin("/admin/import");
  return <ImportForm />;
}
