import type { Metadata, Viewport } from "next";
import { Baloo_Bhaijaan_2, Cairo, Tajawal } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

const baloo = Baloo_Bhaijaan_2({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable} ${baloo.variable}`}>
      <body className="doodle-bg text-brand-950 antialiased">{children}</body>
    </html>
  );
}
