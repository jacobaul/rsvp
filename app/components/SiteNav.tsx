import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/travel", label: "Travel" },
  { href: "/registry", label: "Registry" },
  { href: "/rsvp", label: "RSVP" },
];

export function SiteNav() {
  return (
    <nav aria-label="Site sections" className="flex flex-wrap gap-x-6 gap-y-2 text-sm uppercase tracking-[0.25em] text-muted">
      {navItems.map((item) => (
        <Link key={item.href} href={item.href} className="transition hover:text-foreground">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}