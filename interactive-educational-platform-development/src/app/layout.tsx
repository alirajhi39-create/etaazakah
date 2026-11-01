import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "إيتاء الزكاة | منصة العروس الابتدائية",
  description:
    "الدرس السادس: إيتاء الزكاة — الدراسات الإسلامية (التوحيد)، الصف الثالث الابتدائي. المعلم: علي عبدالله راجحي، مدرسة العروس الابتدائية.",
  keywords: ["إيتاء الزكاة", "الدراسات الإسلامية", "الصف الثالث الابتدائي", "العروس الابتدائية", "تعلم تفاعلي"],
};

export const viewport: Viewport = {
  themeColor: "#11645c",
  width: "device-width",
  initialScale: 1,
};

/**
 * الخطوط تُحمّل عبر CSS في المتصفح (Cairo + Tajawal + Baloo Bhaijaan 2)
 * بدل next/font حتى لا يعتمد بناء المشروع على الوصول إلى Google Fonts،
 * مع بدائل نظام عربية واضحة إذا تعذّر تحميلها.
 */
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@400;500;600;700;800&family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
      </head>
      <body className="doodle-bg text-brand-950 antialiased">{children}</body>
    </html>
  );
}
