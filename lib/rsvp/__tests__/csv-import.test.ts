import { describe, expect, it } from "vitest";

import { parseImportCsv } from "../csv-import";

describe("parseImportCsv", () => {
  it("groups guest rows into parties", () => {
    const result = parseImportCsv(
      [
        "party,first_name,last_name,plus_ones_allowed,email,tags",
        "The Smiths,Ann,Smith,0,ann@example.com,family",
        "The Smiths,Bob,Smith,0,,family",
        "Cara Lee,Cara,Lee,2,,work",
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.parties).toHaveLength(2);

    const smiths = result.parties[0];
    expect(smiths.name).toBe("The Smiths");
    expect(smiths.guests.map((g) => g.firstName)).toEqual(["Ann", "Bob"]);
    expect(smiths.email).toBe("ann@example.com");
    expect(smiths.tags).toEqual(["family"]);

    const cara = result.parties[1];
    expect(cara.plusOnesAllowed).toBe(2);
  });

  it("handles quoted fields containing commas", () => {
    const result = parseImportCsv(
      [
        "party,first_name,last_name,notes",
        '"Lee, Dana and Kit",Dana,Lee,"Allergic to nuts, shellfish"',
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.parties[0].name).toBe("Lee, Dana and Kit");
    expect(result.parties[0].adminNotes).toBe("Allergic to nuts, shellfish");
  });

  it("strips a UTF-8 BOM from the header", () => {
    const result = parseImportCsv(
      "﻿party,first_name\nThe Smiths,Ann",
    );

    expect(result.errors).toEqual([]);
    expect(result.parties).toHaveLength(1);
    expect(result.parties[0].name).toBe("The Smiths");
  });

  it("reads plus-one counts, and maps the legacy yes/no spelling", () => {
    const result = parseImportCsv(
      [
        "party,first_name,plus_ones_allowed",
        "A,Ann,YES",
        "B,Bob,true",
        "C,Cal,1",
        "D,Dee,no",
        "E,Eve,",
        "F,Fay,3",
        "G,Gil,2",
      ].join("\n"),
    );

    expect(result.parties.map((p) => p.plusOnesAllowed)).toEqual([
      1, 1, 1, 0, 0, 3, 2,
    ]);
  });

  it("clamps a count above the cap and rejects nonsense", () => {
    const result = parseImportCsv(
      [
        "party,first_name,plus_ones_allowed",
        "A,Ann,9",
        "B,Bob,-2",
        "C,Cal,banana",
      ].join("\n"),
    );

    expect(result.parties.map((p) => p.plusOnesAllowed)).toEqual([3, 0, 0]);
  });

  it("still accepts the legacy plus_one_allowed header", () => {
    const result = parseImportCsv(
      "party,first_name,plus_one_allowed\nA,Ann,true\nB,Bob,false",
    );

    expect(result.parties.map((p) => p.plusOnesAllowed)).toEqual([1, 0]);
  });

  it("takes the largest allowance seen across a party's rows", () => {
    const result = parseImportCsv(
      [
        "party,first_name,plus_ones_allowed",
        "The Smiths,Ann,0",
        "The Smiths,Bob,2",
      ].join("\n"),
    );

    expect(result.parties[0].plusOnesAllowed).toBe(2);
  });

  it("normalizes a supplied code and rejects a malformed one", () => {
    const good = parseImportCsv(
      "party,first_name,code\nA,Ann,abcd-efgh",
    );
    expect(good.errors).toEqual([]);
    expect(good.parties[0].code).toBe("ABCDEFGH");

    const bad = parseImportCsv("party,first_name,code\nA,Ann,SHORT");
    expect(bad.errors[0].message).toMatch(/not a valid/);
  });

  it("flags the same code used by two parties", () => {
    const result = parseImportCsv(
      [
        "party,first_name,code",
        "A,Ann,ABCD-EFGH",
        "B,Bob,ABCD-EFGH",
      ].join("\n"),
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/more than one party/);
    expect(result.errors[0].line).toBe(3);
  });

  it("reports the row number of an invalid email", () => {
    const result = parseImportCsv(
      [
        "party,first_name,email",
        "A,Ann,fine@example.com",
        "B,Bob,not-an-email",
      ].join("\n"),
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(3);
    expect(result.errors[0].message).toMatch(/email/);
  });

  it("requires the party and first_name columns", () => {
    const result = parseImportCsv("name,guest\nA,Ann");

    expect(result.parties).toEqual([]);
    expect(result.errors[0].message).toMatch(/Missing required column/);
  });

  it("reports an empty file rather than throwing", () => {
    expect(parseImportCsv("").errors[0].message).toMatch(/no data rows/);
  });

  it("tolerates header casing and spacing", () => {
    const result = parseImportCsv(
      "Party, First Name , Last Name\nThe Smiths,Ann,Smith",
    );

    expect(result.errors).toEqual([]);
    expect(result.parties[0].guests[0].lastName).toBe("Smith");
  });

  it("splits tags on commas and semicolons and lowercases them", () => {
    const result = parseImportCsv(
      'party,first_name,tags\nA,Ann,"Work; Bride-Family, work"',
    );

    expect(result.parties[0].tags).toEqual(["work", "bride-family"]);
  });
});
