import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // الصور التوضيحية تُخدم مباشرة من مجلد public — يعمل على Vercel وأي استضافة بدون معالج صور
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [
      // منع تخزين صفحات HTML حتى يظهر كل نشر جديد فورًا للزائرين
      { source: "/teacher", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
      { source: "/", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
      // صور الدرس: تخزين طويل (ملفات ثابتة)
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
