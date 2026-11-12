"use client";

/** মূল কাঠামোতেই (layout) ত্রুটি হলে — নিজস্ব html/body লাগে, তাই সাধারণ স্টাইল। */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="bn">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f4f6f3", color: "#1c2733", textAlign: "center", padding: "80px 16px" }}>
        <h1 style={{ fontSize: 28 }}>সাইটে সাময়িক সমস্যা হচ্ছে</h1>
        <p style={{ fontSize: 18 }}>আপনার অগ্রগতি সংরক্ষিত আছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।</p>
        <button onClick={reset} style={{ marginTop: 24, padding: "10px 20px", fontSize: 16, background: "#006a4e", color: "#fff", border: 0, borderRadius: 8 }}>
          আবার চেষ্টা করুন
        </button>
      </body>
    </html>
  );
}
