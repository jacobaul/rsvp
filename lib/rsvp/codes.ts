import { randomInt } from "node:crypto";

/**
 * Crockford-ish alphabet with the ambiguous glyphs removed: no I, O, 0, 1.
 * 32 symbols over 8 characters gives 40 bits of entropy per code.
 */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** Characters guests commonly mistype, mapped to what the card actually shows. */
const CONFUSABLES: Record<string, string> = {
  "0": "O",
  O: "O",
  "1": "L",
  I: "L",
  L: "L",
};

/**
 * Uppercase, strip separators, and fold look-alike characters so a guest who
 * reads `0` for `O` still lands on their invite.
 */
export function normalizeCode(input: string): string {
  const stripped = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  return stripped
    .split("")
    .map((character) => CONFUSABLES[character] ?? character)
    .join("");
}

/** `ABCD-EFGH` — the form printed on the card and used in URLs. */
export function formatCode(code: string): string {
  const normalized = normalizeCode(code);

  if (normalized.length !== CODE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function isValidCodeShape(code: string): boolean {
  const normalized = normalizeCode(code);

  if (normalized.length !== CODE_LENGTH) {
    return false;
  }

  return normalized.split("").every((character) =>
    CODE_ALPHABET.includes(character),
  );
}

/** Cryptographically random code. Uniform: randomInt avoids modulo bias. */
export function generateCode(): string {
  let code = "";

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }

  return code;
}

/** `n` distinct codes, none of which appear in `taken`. */
export function generateUniqueCodes(
  count: number,
  taken: Iterable<string> = [],
): string[] {
  const used = new Set(Array.from(taken, normalizeCode));
  const generated: string[] = [];

  while (generated.length < count) {
    const candidate = generateCode();

    if (!used.has(candidate)) {
      used.add(candidate);
      generated.push(candidate);
    }
  }

  return generated;
}
