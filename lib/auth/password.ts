// Deliberately not marked `server-only`: scripts/hash-password.mts runs this
// from the CLI. It is pure crypto with no request or env access, and is only
// imported from server actions.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * Separator is "." and NOT "$".
 *
 * The hash is carried in ADMIN_PASSWORD_HASH, and Next.js loads .env through
 * dotenv-expand, which treats `$name` as a variable reference and replaces it
 * with an empty string. A `$`-separated hash therefore arrives at the server
 * silently mangled, and every login fails with "wrong password". Base64url
 * uses A-Za-z0-9-_ so "." can never appear inside a field.
 */
const SEPARATOR = ".";
const FIELD_COUNT = 6;

/** `scrypt.N.r.p.salt.hash`, base64url. Safe to paste into an env file. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(
    password.normalize("NFKC"),
    salt,
    KEY_LENGTH,
    PARAMS,
  );

  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join(SEPARATOR);
}

/**
 * Splits a stored hash into its fields. Accepts the legacy `$` separator so an
 * older hash still works when it reaches the process intact, for example when
 * it is set directly in the environment rather than through a .env file.
 */
function parseHash(stored: string): string[] | null {
  const separator = stored.includes(SEPARATOR) ? SEPARATOR : "$";
  const parts = stored.split(separator);

  if (parts.length !== FIELD_COUNT || parts[0] !== "scrypt") {
    return null;
  }

  return parts;
}

/**
 * True when the value looks like a hash this module produced. The login action
 * checks it so a mangled or missing env var reports itself, instead of looking
 * to the user like a wrong password.
 */
export function isValidHashFormat(stored: string | undefined): boolean {
  if (!stored) {
    return false;
  }

  const parts = parseHash(stored);

  if (!parts) {
    return false;
  }

  const [, n, r, p] = parts;

  if (![n, r, p].every((value) => Number.isInteger(Number(value)))) {
    return false;
  }

  try {
    return Buffer.from(parts[5], "base64url").length === KEY_LENGTH;
  } catch {
    return false;
  }
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = parseHash(stored);

  if (!parts) {
    return false;
  }

  const [, n, r, p, saltB64, hashB64] = parts;

  let salt: Buffer;
  let expected: Buffer;

  try {
    salt = Buffer.from(saltB64, "base64url");
    expected = Buffer.from(hashB64, "base64url");
  } catch {
    return false;
  }

  if (expected.length !== KEY_LENGTH || salt.length === 0) {
    return false;
  }

  const parsedN = Number(n);
  const parsedR = Number(r);
  const parsedP = Number(p);

  if (
    !Number.isInteger(parsedN) ||
    !Number.isInteger(parsedR) ||
    !Number.isInteger(parsedP)
  ) {
    return false;
  }

  let derived: Buffer;

  try {
    derived = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH, {
      N: parsedN,
      r: parsedR,
      p: parsedP,
      maxmem: PARAMS.maxmem,
    });
  } catch {
    // Invalid scrypt parameters in a tampered or corrupted hash.
    return false;
  }

  return timingSafeEqual(derived, expected);
}
