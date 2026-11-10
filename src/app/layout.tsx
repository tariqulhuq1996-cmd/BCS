import type { Metadata } from "next";
import { Anek_Bangla, Hind_Siliguri } from "next/font/google";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { appUrl } from "@/lib/env";
import "./globals.css";

const display = Anek_Bangla({
  variable: "--font-display",
  subsets: ["bengali", "latin"],
  weight: "variable",
  axes: ["wdth"],
  display: "swap",
});

const body = Hind_Siliguri({
  variable: "--font-body",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  openGraph: { type: "website", locale: "bn_BD", siteName: "বিসিএস ৫২ প্রস্তুতি" },
  title: { default: "৫২তম বিসিএস প্রিলিমিনারি — গবেষণাভিত্তিক প্রস্তুতি", template: "%s — বিসিএস ৫২ প্রস্তুতি" },
  description:
    "১০ম–৫০তম বিসিএসের ৫,৩৫২টি প্রশ্নের বিশ্লেষণ থেকে তৈরি ধাপে ধাপে প্রস্তুতি: বিগত প্রশ্ন, টপিকভিত্তিক অনুশীলন, Revision ও পূর্ণাঙ্গ Model Test।",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">
          মূল অংশে যান
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
