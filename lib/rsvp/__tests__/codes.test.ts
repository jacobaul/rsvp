import { describe, expect, it } from "vitest";

import {
  CODE_ALPHABET,
  CODE_LENGTH,
  formatCode,
  generateCode,
  generateUniqueCodes,
  isValidCodeShape,
  normalizeCode,
} from "../codes";

describe("normalizeCode", () => {
  it("uppercases and strips separators", () => {
    expect(normalizeCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeCode(" abcd efgh ")).toBe("ABCDEFGH");
    expect(normalizeCode("ABCD_EFGH")).toBe("ABCDEFGH");
  });

  it("folds look-alike characters guests mistype", () => {
    expect(normalizeCode("0BCD-EFGH")).toBe("OBCDEFGH");
    expect(normalizeCode("1BCD-EFGH")).toBe("LBCDEFGH");
    expect(normalizeCode("IBCD-EFGH")).toBe("LBCDEFGH");
  });

  it("is idempotent", () => {
    const once = normalizeCode("0bcd-1fgh");
    expect(normalizeCode(once)).toBe(once);
  });
});

describe("formatCode", () => {
  it("inserts the dash at the midpoint", () => {
    expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
    expect(formatCode("abcdefgh")).toBe("ABCD-EFGH");
  });

  it("leaves wrong-length input normalized but unformatted", () => {
    expect(formatCode("ABC")).toBe("ABC");
  });
});

describe("isValidCodeShape", () => {
  it("accepts generated codes", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(isValidCodeShape(generateCode())).toBe(true);
    }
  });

  it("rejects wrong lengths", () => {
    expect(isValidCodeShape("ABCDEFG")).toBe(false);
    expect(isValidCodeShape("ABCDEFGHJ")).toBe(false);
  });

  it("rejects characters outside the alphabet after folding", () => {
    // U is in the alphabet; @ is stripped, leaving a short code.
    expect(isValidCodeShape("ABCD@EFG")).toBe(false);
  });
});

describe("generateCode", () => {
  it("produces codes of the right shape", () => {
    const code = generateCode();
    expect(code).toHaveLength(CODE_LENGTH);
    expect(code.split("").every((c) => CODE_ALPHABET.includes(c))).toBe(true);
  });

  it("does not emit ambiguous glyphs", () => {
    const joined = Array.from({ length: 200 }, generateCode).join("");
    expect(joined).not.toMatch(/[IO01]/);
  });
});

describe("generateUniqueCodes", () => {
  it("returns the requested number of distinct codes", () => {
    const codes = generateUniqueCodes(100);
    expect(codes).toHaveLength(100);
    expect(new Set(codes).size).toBe(100);
  });

  it("avoids codes already taken", () => {
    const taken = generateUniqueCodes(20);
    const fresh = generateUniqueCodes(20, taken);
    const overlap = fresh.filter((code) => taken.includes(code));
    expect(overlap).toEqual([]);
  });

  it("treats taken codes case-insensitively", () => {
    const taken = ["abcd-efgh"];
    const fresh = generateUniqueCodes(5, taken);
    expect(fresh).not.toContain("ABCDEFGH");
  });
});
