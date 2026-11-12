import { NextResponse, type NextRequest } from "next/server";

/**
 * আশাবাদী যাচাই: সেশন-কুকি না থাকলে সুরক্ষিত পাতা থেকে সরাসরি লগইনে পাঠানো।
 * আসল যাচাই (সেশন বৈধ কি না, মেয়াদ, ভূমিকা) প্রতিটি পাতা ও Server Action-এ সার্ভারে হয়।
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("bcs_session")) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/revision/:path*", "/mistakes/:path*", "/readiness-report/:path*", "/admin/:path*", "/level-1/:path*", "/level-2/:path*", "/level-3/:path*", "/test/:path*", "/result/:path*", "/current-affairs/:path*", "/research/:path*", "/repeated-questions/:path*"],
};
