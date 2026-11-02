"use client";

import { useState } from "react";
import { HERO_ILLUSTRATION, WARNING_ILLUSTRATION } from "@/lib/illustrations";

type Props = {
  name: "zakat-hero" | "zakat-warning";
  alt: string;
  width: number;
  height: number;
  className?: string;
  eager?: boolean;
};

const INLINE: Record<Props["name"], string> = {
  "zakat-hero": HERO_ILLUSTRATION,
  "zakat-warning": WARNING_ILLUSTRATION,
};

/**
 * صورة الدرس بخلفية مضمّنة داخل الحزمة (base64) فلا تعتمد على أي ملف على الاستضافة
 * ولا يظهر أبدًا رمز صورة مكسورة. هناك أيضًا طبقة SVG احتياطية عند فشل فك ترميز الصورة.
 */
export default function LessonImage({ name, alt, width, height, className, eager = false }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className ?? ""} grid place-items-center bg-gradient-to-bl from-brand-100 via-sand-100 to-gold-100`}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
          <rect width="320" height="200" fill="#eafaf1" rx="14" />
          <circle cx="258" cy="42" r="18" fill="#ffce45" opacity="0.9" />
          <path d="M60 118V96a80 80 0 0 1 160 0v22" fill="none" stroke="#0b8259" strokeWidth="7" strokeLinecap="round" />
          <rect x="48" y="118" width="184" height="52" rx="10" fill="#0a6849" />
          <circle cx="118" cy="146" r="9" fill="#ffce45" />
          <circle cx="140" cy="146" r="9" fill="#ffe285" />
          <circle cx="162" cy="146" r="9" fill="#ffe285" />
          <circle cx="266" cy="150" r="16" fill="#ffb81c" />
          <circle cx="266" cy="150" r="9" fill="#fff9e6" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={INLINE[name]}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
