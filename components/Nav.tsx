"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDownload, IconHome, IconLibrary, IconSearch } from "./Icons";

const LINKS = [
  { href: "/", label: "Acasă", Icon: IconHome },
  { href: "/cauta/", label: "Caută", Icon: IconSearch },
  { href: "/biblioteca/", label: "Biblioteca", Icon: IconLibrary },
  { href: "/descarcari/", label: "Descărcări", Icon: IconDownload },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  return path.startsWith(href.replace(/\/$/, ""));
}

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Bibliotheca, pagina principală">
      bibliotheca
      <span className="logo-dot" aria-hidden="true" />
    </Link>
  );
}

export function TopBar() {
  const path = usePathname() || "/";
  return (
    <header className="topbar">
      <Logo />
      <nav className="topnav" aria-label="Navigare">
        {LINKS.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <Link href="/cauta/" className="icon-btn" aria-label="Caută">
        <IconSearch />
      </Link>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname() || "/";
  return (
    <nav className="bottomnav" aria-label="Navigare principală">
      {LINKS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}>
          <Icon />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
