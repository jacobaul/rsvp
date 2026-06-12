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
    <nav
      aria-label="Site sections"
      className="mx-auto grid w-full max-w-md grid-cols-6 justify-items-center gap-x-4 gap-y-3 text-center text-sm uppercase tracking-[0.2em] text-muted sm:mx-0 sm:flex sm:max-w-none sm:flex-wrap sm:justify-end sm:gap-x-6 sm:gap-y-2 sm:text-left sm:tracking-[0.25em]"
    >
      {navItems.map((item, index) => (
        <Link
          key={item.href}
          href={item.href}
          className={`col-span-2 transition hover:text-foreground ${
            index === 3 ? "col-start-2" : index === 4 ? "col-start-4" : ""
          } sm:col-auto`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}