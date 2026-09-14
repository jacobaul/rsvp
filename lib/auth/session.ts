import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "rsvp_admin_session";
export const SESSION_PATH = "/";
const SESSION_DAYS = 7;

export type SessionPayload = {
  role: "admin";
  issuedAt: number;
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Generate one with: openssl rand -base64 32",
    );
  }

  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });

    if (payload.role !== "admin") {
      return null;
    }

    return {
      role: "admin",
      issuedAt: Number(payload.issuedAt ?? 0),
    };
  } catch {
    return null;
  }
}

export async function createSession(): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await encryptSession({ role: "admin", issuedAt: Date.now() });
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: SESSION_PATH,
  });
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: SESSION_COOKIE, path: SESSION_PATH });
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();

  return decryptSession(store.get(SESSION_COOKIE)?.value);
}
