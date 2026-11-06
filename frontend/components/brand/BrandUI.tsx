"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BRAND } from "../../lib/brand";

type LogoMarkProps = { className?: string; size?: "sm" | "md" | "lg" };

export function LogoMark({ className = "", size = "md" }: LogoMarkProps) {
  const sizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };
  return (
    <span aria-hidden="true" className={`logo-mark ${sizes[size]} ${className}`}>
      <svg viewBox="0 0 40 40" className="h-full w-full" fill="none">
        <path d="M9 8.5h22a4.5 4.5 0 0 1 4.5 4.5v13a4.5 4.5 0 0 1-4.5 4.5H19l-8 5v-5.4A4.5 4.5 0 0 1 6 26V13a4.5 4.5 0 0 1 3-4.5Z" fill="currentColor" />
        <path d="M14 23v-5m6 8V14m6 9v-5" stroke="var(--logo-mark-line, white)" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    </span>
  );
}

export function Logo({ className = "", markSize = "md" }: { className?: string; markSize?: LogoMarkProps["size"] }) {
  const wordmark = BRAND.name.toLowerCase();
  return (
    <span role="img" aria-label={BRAND.name} className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={markSize} />
      <span className="font-display brand-wordmark text-[1.45rem] leading-none text-ink">
        {wordmark.split("").map((letter, index) => index === 4
          ? <span key={`${letter}-${index}`} className="brand-wordmark-highlight">{letter}</span>
          : <span key={`${letter}-${index}`}>{letter}</span>)}
      </span>
    </span>
  );
}

export function Highlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <span ref={elementRef} className={`marker-highlight ${visible ? "is-visible" : ""} ${className}`}>{children}</span>;
}

export function DottedBackground({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`dotted-background ${className}`}>
      <div className="dotted-background-glow" />
      <div className="dotted-background-pattern" />
      <svg className="dotted-background-arcs" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <circle cx="800" cy="0" r="250" />
        <circle cx="800" cy="0" r="350" />
        <circle cx="800" cy="0" r="450" />
      </svg>
      <div className="dot-cluster dot-cluster-three" />
      <div className="dot-cluster dot-cluster-four" />
      <span className="arc-dot" />
    </div>
  );
}

export function DottedLines({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" className={`marketing-dotted-lines ${className}`} viewBox="0 0 1440 900" preserveAspectRatio="none">
    <path d="M-80 120C250 100 320 350 560 485s510 230 970 20" />
    <path d="M-70 735C250 620 470 700 650 830s420 100 860-15" />
    <circle cx="1130" cy="505" r="5" />
  </svg>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  href?: string;
};

export function Button({ variant = "primary", href, className = "", children, ...props }: ButtonProps) {
  const classes = `brand-button brand-button-${variant} ${className}`;
  if (href) return <Link href={href} className={classes}>{children}</Link>;
  return <button {...props} className={classes}>{children}</button>;
}
