import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 pt-20 text-center sm:px-6">
      <h1 className="text-[32px] font-extrabold">এই পাতাটি নেই</h1>
      <p className="mt-3 text-lg text-ink-2">ঠিকানাটি ভুল, অথবা পাতাটি সরানো হয়েছে।</p>
      <div className="mt-8 flex justify-center gap-5">
        <Link href="/dashboard" className="rounded-lg bg-green px-5 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">আমার Dashboard</Link>
        <Link href="/" className="px-2 py-2.5 text-green underline underline-offset-4">হোমপেজ</Link>
      </div>
    </section>
  );
}
