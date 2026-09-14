import "server-only";

import { headers } from "next/headers";

export type RequestContext = {
  ip: string | null;
  userAgent: string | null;
};

/**
 * The app is only reachable through the Cloudflare tunnel, so
 * `cf-connecting-ip` is trustworthy here. Falls back to the first hop of
 * `x-forwarded-for` for local development.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();

  return {
    ip: readIp(headerList),
    userAgent: headerList.get("user-agent"),
  };
}

export function readIp(headerList: Headers): string | null {
  const cloudflare = headerList.get("cf-connecting-ip");

  if (cloudflare) {
    return sanitizeIp(cloudflare);
  }

  const forwarded = headerList.get("x-forwarded-for");

  if (forwarded) {
    return sanitizeIp(forwarded.split(",")[0]);
  }

  return sanitizeIp(headerList.get("x-real-ip"));
}

/**
 * The `ip` column is Postgres `inet`, which rejects malformed values, so a
 * spoofed header must never reach the insert.
 */
export function sanitizeIp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/^\[|\]$/g, "");

  if (!trimmed) {
    return null;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ipv4.exec(trimmed);

  if (match) {
    const valid = match
      .slice(1)
      .every((octet) => Number(octet) >= 0 && Number(octet) <= 255);

    return valid ? trimmed : null;
  }

  // Loose IPv6 check: hex groups and colons only, at least one colon.
  if (/^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(":")) {
    return trimmed;
  }

  return null;
}

/** Key used for per-IP rate limiting; unknown IPs share one bucket. */
export function rateLimitKey(scope: string, ip: string | null): string {
  return `${scope}:${ip ?? "unknown"}`;
}
