"use client";

import { useState } from "react";

type Props = {
  name: "zakat-hero" | "zakat-warning";
  alt: string;
  width: number;
  height: number;
  className?: string;
  eager?: boolean;
};

/**
 * صورة الدرس مع سلسلة بدائل مضمونة:
 * 1) صيغة WebP  2) صيغة PNG  3) رسم SVG مدمج (يظهر دائمًا حتى لو لم تُرفع الصور على الاستضافة)
 */
export default function LessonImage({ name, alt, width, height, className, eager = false }: Props) {
  const [stage, setStage] = useState(0);

  if (stage >= 2) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className ?? ""} grid place-items-center bg-gradient-to-bl from-brand-100 via-sand-100 to-gold-100`}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={`sky-${name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8f1e6" />
              <stop offset="100%" stopColor="#fff9e6" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill={`url(#sky-${name})`} rx="16" />
          <circle cx="262" cy="40" r="20" fill="#ffce45" opacity="0.85" />
          <path d="M40 120h240v46a10 10 0 0 1-10 10H50a10 10 0 0 1-10-10z" fill="#0a6849" />
          <path d="M75 120V96a85 85 0 0 1 170 0v24" fill="none" stroke="#0b8259" strokeWidth="8" strokeLinecap="round" />
          <circle cx="160" cy="150" r="12" fill="#ffce45" />
          <circle cx="120" cy="150" r="8" fill="#ffe285" />
          <circle cx="200" cy="150" r="8" fill="#ffe285" />
          <path d="M40 60c14 0 14-16 28-16s14 16 28 16" fill="none" stroke="#63d4a2" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          <ellipse cx="95" cy="176" rx="26" ry="7" fill="#0a533b" opacity="0.25" />
          <ellipse cx="225" cy="176" rx="26" ry="7" fill="#0a533b" opacity="0.25" />
          <circle cx="95" cy="132" r="14" fill="#ffb81c" opacity="0.9" />
          <circle cx="225" cy="132" r="14" fill="#ffb81c" opacity="0.9" />
        </svg>
      </div>
    );
  }

  const src = stage === 0 ? `/images/${name}.webp` : `/images/${name}.png`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setStage((current) => current + 1)}
      className={className}
    />
  );
}
