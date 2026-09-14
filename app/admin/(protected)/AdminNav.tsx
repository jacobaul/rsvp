"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/parties", label: "Parties" },
  { href: "/admin/responses", label: "Responses" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/qr", label: "QR codes" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap gap-x-5 gap-y-2 text-sm uppercase tracking-[0.15em]"
    >
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "border-b-2 border-accent pb-1 font-semibold text-foreground"
                : "border-b-2 border-transparent pb-1 text-muted transition hover:text-foreground"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
