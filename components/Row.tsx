"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { IconChevronLeft, IconChevronRight } from "./Icons";

export function Row({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  return (
    <section className="row">
      <div className="row-head">
        <div>
          <h2 className="row-title">{title}</h2>
          {subtitle && <p className="row-subtitle">{subtitle}</p>}
        </div>
        <div className="row-tools">
          {href && (
            <Link href={href} className="row-more">
              Vezi tot
            </Link>
          )}
          <button className="row-arrow" type="button" aria-label="Înapoi" onClick={() => page(-1)}>
            <IconChevronLeft size={22} />
          </button>
          <button className="row-arrow" type="button" aria-label="Mai departe" onClick={() => page(1)}>
            <IconChevronRight size={22} />
          </button>
        </div>
      </div>
      <div className="row-scroller" ref={scroller}>
        {children}
      </div>
    </section>
  );
}
