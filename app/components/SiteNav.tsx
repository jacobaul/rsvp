import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Details" },
  { href: "/gifts", label: "Gifts" },
  { href: "/rsvp", label: "RSVP" },
];

export function SiteNav() {
  return (
    <nav
      aria-label="Site sections"
      className="mx-auto grid w-full max-w-xs grid-cols-2 justify-items-center gap-x-4 gap-y-3 text-center text-sm uppercase tracking-[0.2em] text-muted sm:mx-0 sm:flex sm:max-w-none sm:flex-wrap sm:justify-end sm:gap-x-6 sm:gap-y-2 sm:text-left sm:tracking-[0.25em]"
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="transition hover:text-foreground"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}