import type { Metadata } from "next";
import StudentPortal from "@/components/StudentPortal";
import { LESSON_META } from "@/lib/lesson";

export const metadata: Metadata = {
  title: `درس إيتاء الزكاة | ${LESSON_META.school}`,
  description:
    "الدرس السادس: إيتاء الزكاة — الدراسات الإسلامية (التوحيد) للصف الثالث الابتدائي. معنى الزكاة، الدليل على وجوبها، فضلها، الإخلاص والمتابعة، أثر منعها، ادّخار المال، والتقويم.",
};

export default function HomePage() {
  return <StudentPortal />;
}
