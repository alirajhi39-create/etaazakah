import type { Metadata } from "next";
import TeacherDashboard from "@/components/TeacherDashboard";
import { LESSON_META } from "@/lib/lesson";

export const metadata: Metadata = {
  title: "لوحة تحكم المعلم | متابعة درس إيتاء الزكاة",
  description: `لوحة متابعة أداء الطلاب وإدارة فصولهم وأصوات الدرس — ${LESSON_META.school}`,
};

export default function TeacherPage() {
  return <TeacherDashboard />;
}
