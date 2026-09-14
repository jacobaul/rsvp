import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-accent/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-foreground">
          {title}
        </h1>
        {description ? (
          <div className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-accent/25 bg-card px-5 py-5 sm:px-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="border border-accent/25 bg-card px-5 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-none text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  responded: "border-accent/50 bg-accent/15 text-accent-strong",
  declined: "border-red-300 bg-red-50 text-red-800",
  viewed: "border-amber-300 bg-amber-50 text-amber-800",
  not_viewed: "border-accent/20 bg-background text-muted",
  neutral: "border-accent/20 bg-background text-muted",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof badgeStyles | string;
  children: ReactNode;
}) {
  const style = badgeStyles[tone] ?? badgeStyles.neutral;

  return (
    <span
      className={`inline-block whitespace-nowrap border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {children}
    </span>
  );
}

export const buttonClass =
  "inline-block border border-accent bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-accent-strong disabled:opacity-60";

export const secondaryButtonClass =
  "inline-block border border-accent/40 px-4 py-2 text-sm font-semibold uppercase tracking-[0.15em] text-foreground transition hover:border-accent disabled:opacity-60";

export const dangerButtonClass =
  "inline-block border border-red-400 px-4 py-2 text-sm font-semibold uppercase tracking-[0.15em] text-red-800 transition hover:bg-red-50 disabled:opacity-60";

export const inputClass =
  "w-full border border-accent/30 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none";

export const labelClass =
  "block text-xs uppercase tracking-[0.2em] text-muted";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-accent/30 bg-card/50 px-6 py-12 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function formatDateTime(value: Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Vancouver",
  }).format(value);
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "America/Vancouver",
  }).format(value);
}
