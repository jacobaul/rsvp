/**
 * Dev helper: prints a valid admin session cookie value so smoke tests can hit
 * protected routes without driving the login form.
 */
import { existsSync } from "node:fs";

import { SignJWT } from "jose";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const secret = process.env.SESSION_SECRET;

if (!secret) {
  console.error("SESSION_SECRET is not set");
  process.exit(1);
}

const token = await new SignJWT({ role: "admin", issuedAt: Date.now() })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(new TextEncoder().encode(secret));

console.log(token);
