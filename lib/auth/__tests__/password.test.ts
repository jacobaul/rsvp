import { describe, expect, it } from "vitest";

import {
  hashPassword,
  isValidHashFormat,
  verifyPassword,
} from "../password";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(
      verifyPassword("correct horse battery staple", hash),
    ).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("produces a different salt each time", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    await expect(verifyPassword("same password", a)).resolves.toBe(true);
    await expect(verifyPassword("same password", b)).resolves.toBe(true);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    await expect(verifyPassword("x", "")).resolves.toBe(false);
    await expect(verifyPassword("x", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt.1.2.3.bad")).resolves.toBe(false);
    await expect(
      verifyPassword("x", "bcrypt.16384.8.1.AAAA.BBBB"),
    ).resolves.toBe(false);
  });

  it("never uses $ as a separator", async () => {
    // Next.js loads .env through dotenv-expand, which replaces `$name` with an
    // empty string. A $-separated hash arrives at the server mangled and every
    // login fails, which is a very hard failure to diagnose.
    const hash = await hashPassword("some password");
    expect(hash).not.toContain("$");
    expect(hash.split(".")).toHaveLength(6);
    expect(hash.startsWith("scrypt.")).toBe(true);
  });

  it("still verifies a legacy $-separated hash that arrives intact", async () => {
    const hash = await hashPassword("legacy password");
    const legacy = hash.replace(/\./g, "$");
    await expect(verifyPassword("legacy password", legacy)).resolves.toBe(true);
  });

  it("survives a round trip through a dotenv-style parser", async () => {
    // Reproduces the real failure: dotenv-expand eats `$name` references.
    const expand = (value: string) => value.replace(/\$[A-Za-z0-9_]*/g, "");

    const good = await hashPassword("round trip");
    expect(expand(good)).toBe(good);
    await expect(verifyPassword("round trip", expand(good))).resolves.toBe(true);

    const legacy = good.replace(/\./g, "$");
    expect(expand(legacy)).not.toBe(legacy);
    await expect(verifyPassword("round trip", expand(legacy))).resolves.toBe(
      false,
    );
  });

  it("normalizes unicode so equivalent input matches", async () => {
    // e + combining acute vs. precomposed e-acute
    const hash = await hashPassword("café");
    await expect(verifyPassword("café", hash)).resolves.toBe(true);
  });

  describe("isValidHashFormat", () => {
    it("accepts a freshly generated hash", async () => {
      expect(isValidHashFormat(await hashPassword("a password"))).toBe(true);
    });

    it("rejects missing, empty, and structurally wrong values", async () => {
      expect(isValidHashFormat(undefined)).toBe(false);
      expect(isValidHashFormat("")).toBe(false);
      expect(isValidHashFormat("scrypt")).toBe(false);
      expect(isValidHashFormat("scrypt.16384.8.1.AAAA.BBBB")).toBe(false);
      expect(isValidHashFormat("scrypt.x.y.z.AAAA.BBBB")).toBe(false);
    });

    it("rejects a hash that dotenv expansion has damaged", async () => {
      const good = await hashPassword("a password");
      const damaged = good.replace(/\./g, "$").replace(/\$[A-Za-z0-9_]*/g, "");
      expect(isValidHashFormat(damaged)).toBe(false);
    });
  });
});
