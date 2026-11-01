import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // الصور التوضيحية تُخدم مباشرة من مجلد public — يعمل على Vercel وأي استضافة بدون معالج صور
  images: { unoptimized: true },
  // لا تُخفِ أخطاء الاتصال بقاعدة البيانات وقت البناء
  logging: { fetches: { fullUrl: false } },
};

export default nextConfig;
