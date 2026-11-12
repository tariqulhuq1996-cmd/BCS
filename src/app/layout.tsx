import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Noto_Sans_Bengali } from "next/font/google";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { PREFS_SCRIPT, RegisterServiceWorker } from "@/components/site/display-settings";
import { appUrl } from "@/lib/env";
import "./globals.css";

const display = Anek_Bangla({
  variable: "--font-display",
  subsets: ["bengali", "latin"],
  weight: "variable",
  axes: ["wdth"],
  display: "swap",
});

// সাধারণ লেখা: Noto Sans Bengali — মুক্ত লাইসেন্স (OFL), সব ওজন (variable, একটি ফাইল),
// নির্ভুল যুক্তাক্ষর, আর বাংলা-ইংরেজি মেশানো লেখায় একই নকশা। শিরোনাম: Anek Bangla (সাইটের নিজস্ব চেহারা)।
const body = Noto_Sans_Bengali({
  variable: "--font-body",
  subsets: ["bengali", "latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  openGraph: { type: "website", locale: "bn_BD", siteName: "BCS ৫২ প্রস্তুতি" },
  title: { default: "৫২তম BCS Preliminary — গবেষণাভিত্তিক প্রস্তুতি", template: "%s — BCS ৫২ প্রস্তুতি" },
  description:
    "১০ম–৫০তম BCS-এর ৫,৩৫২টি প্রশ্নের বিশ্লেষণ থেকে তৈরি ধাপে ধাপে প্রস্তুতি: বিগত প্রশ্ন, টপিকভিত্তিক অনুশীলন, Revision ও পূর্ণাঙ্গ Model Test।",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: লেখার আকার/থিমের data-* পাতা আঁকার আগেই স্ক্রিপ্ট বসায়
    <html lang="bn" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">
          মূল অংশে যান
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
