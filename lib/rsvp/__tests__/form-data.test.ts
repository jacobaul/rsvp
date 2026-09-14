import { describe, expect, it } from "vitest";

import {
  collectAdminGuestAnswers,
  collectGuestAnswers,
  collectGuestRows,
  collectPlusOnes,
  collectRsvpSubmission,
} from "../form-data";
import { rsvpSubmissionSchema } from "@/lib/validation/rsvp";
import { partyFormSchema } from "@/lib/validation/party";

function form(entries: [string, string][]): FormData {
  const data = new FormData();

  for (const [key, value] of entries) {
    data.append(key, value);
  }

  return data;
}

describe("collectGuestAnswers", () => {
  it("reads one answer per posted guest id", () => {
    const answers = collectGuestAnswers(
      form([
        ["guestId", "7"],
        ["guestId", "8"],
        ["guest.7.rsvpStatus", "both"],
        ["guest.7.dietaryNotes", "No shellfish"],
        ["guest.8.rsvpStatus", "declined"],
      ]),
    );

    expect(answers).toEqual([
      {
        guestId: 7,
        rsvpStatus: "both",
        dietaryNotes: "No shellfish",
      },
      { guestId: 8, rsvpStatus: "declined", dietaryNotes: "" },
    ]);
  });

  it("defaults a missing status to pending so validation rejects it", () => {
    const [answer] = collectGuestAnswers(form([["guestId", "7"]]));
    expect(answer.rsvpStatus).toBe("pending");
  });

  it("drops ids that are not positive integers", () => {
    const answers = collectGuestAnswers(
      form([
        ["guestId", "7"],
        ["guestId", "0"],
        ["guestId", "-3"],
        ["guestId", "abc"],
        ["guestId", "1.5"],
      ]),
    );

    expect(answers.map((answer) => answer.guestId)).toEqual([7]);
  });

  it("collapses a duplicated id to one answer", () => {
    const answers = collectGuestAnswers(
      form([
        ["guestId", "7"],
        ["guestId", "7"],
        ["guest.7.rsvpStatus", "both"],
      ]),
    );

    expect(answers).toHaveLength(1);
  });
});

describe("collectPlusOnes", () => {
  it("returns nothing when no rows were filled in", () => {
    expect(collectPlusOnes(form([]))).toEqual([]);
  });

  it("reads several extra guests from parallel arrays", () => {
    const rows = collectPlusOnes(
      form([
        ["plusOne.id", "11"],
        ["plusOne.firstName", "Cara"],
        ["plusOne.lastName", "Lee"],
        ["plusOne.rsvpStatus", "reception"],
        ["plusOne.dietaryNotes", "Vegan"],
        ["plusOne.id", ""],
        ["plusOne.firstName", "Dev"],
        ["plusOne.lastName", "Patel"],
        ["plusOne.rsvpStatus", "both"],
        ["plusOne.dietaryNotes", ""],
      ]),
    );

    expect(rows).toEqual([
      {
        id: 11,
        firstName: "Cara",
        lastName: "Lee",
        rsvpStatus: "reception",
        dietaryNotes: "Vegan",
      },
      {
        id: undefined,
        firstName: "Dev",
        lastName: "Patel",
        rsvpStatus: "both",
        dietaryNotes: "",
      },
    ]);
  });

  it("drops rows with no name, which is how a guest is removed", () => {
    const rows = collectPlusOnes(
      form([
        ["plusOne.id", "11"],
        ["plusOne.firstName", "Cara"],
        ["plusOne.lastName", "Lee"],
        ["plusOne.id", "12"],
        ["plusOne.firstName", "   "],
        ["plusOne.lastName", ""],
      ]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].firstName).toBe("Cara");
  });

  it("defaults attendance to both when the field is absent", () => {
    const rows = collectPlusOnes(
      form([
        ["plusOne.id", ""],
        ["plusOne.firstName", "Cara"],
        ["plusOne.lastName", ""],
      ]),
    );

    expect(rows[0].rsvpStatus).toBe("both");
  });

  it("ignores a non-numeric id rather than trusting it", () => {
    const rows = collectPlusOnes(
      form([
        ["plusOne.id", "abc"],
        ["plusOne.firstName", "Cara"],
        ["plusOne.lastName", "Lee"],
      ]),
    );

    expect(rows[0].id).toBeUndefined();
  });
});

describe("collectRsvpSubmission", () => {
  it("produces a payload the schema accepts", () => {
    const payload = collectRsvpSubmission(
      form([
        ["code", "abcd-efgh"],
        ["email", "ann@example.com"],
        ["phone", "250-555-0143"],
        ["guestMessage", "See you there"],
        ["guestId", "7"],
        ["guest.7.rsvpStatus", "both"],
        ["plusOne.id", ""],
        ["plusOne.firstName", "Cara"],
        ["plusOne.lastName", "Lee"],
        ["plusOne.rsvpStatus", "both"],
      ]),
    );

    const parsed = rsvpSubmissionSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.plusOnes).toHaveLength(1);
    // The code is normalized on the way through.
    expect(parsed.success && parsed.data.code).toBe("ABCDEFGH");
  });

  it("fails validation when a guest has no answer", () => {
    const payload = collectRsvpSubmission(
      form([
        ["code", "ABCD-EFGH"],
        ["email", "ann@example.com"],
        ["guestId", "7"],
      ]),
    );

    const parsed = rsvpSubmissionSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("fails validation on a bad email", () => {
    const payload = collectRsvpSubmission(
      form([
        ["code", "ABCD-EFGH"],
        ["email", "not-an-email"],
        ["guestId", "7"],
        ["guest.7.rsvpStatus", "both"],
      ]),
    );

    const parsed = rsvpSubmissionSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
    expect(
      !parsed.success &&
        parsed.error.issues.some((issue) => issue.path[0] === "email"),
    ).toBe(true);
  });

  it("fails validation on a malformed code", () => {
    const payload = collectRsvpSubmission(
      form([
        ["code", "TOOSHORT1"],
        ["email", "ann@example.com"],
        ["guestId", "7"],
        ["guest.7.rsvpStatus", "both"],
      ]),
    );

    expect(rsvpSubmissionSchema.safeParse(payload).success).toBe(false);
  });
});

describe("collectGuestRows", () => {
  it("pairs the parallel arrays the admin form posts", () => {
    const rows = collectGuestRows(
      form([
        ["guest.id", "3"],
        ["guest.firstName", "Ann"],
        ["guest.lastName", "Smith"],
        ["guest.id", ""],
        ["guest.firstName", "Bob"],
        ["guest.lastName", "Smith"],
      ]),
    );

    expect(rows).toEqual([
      {
        id: 3,
        firstName: "Ann",
        lastName: "Smith",
        rsvpStatus: "pending",
        dietaryNotes: "",
      },
      {
        id: undefined,
        firstName: "Bob",
        lastName: "Smith",
        rsvpStatus: "pending",
        dietaryNotes: "",
      },
    ]);
  });

  it("drops fully blank rows, which is how a guest is removed", () => {
    const rows = collectGuestRows(
      form([
        ["guest.id", "3"],
        ["guest.firstName", "Ann"],
        ["guest.lastName", "Smith"],
        ["guest.id", "4"],
        ["guest.firstName", "   "],
        ["guest.lastName", ""],
      ]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].firstName).toBe("Ann");
  });

  it("keeps a row with only a last name", () => {
    const rows = collectGuestRows(
      form([
        ["guest.id", ""],
        ["guest.firstName", ""],
        ["guest.lastName", "Cher"],
      ]),
    );

    expect(rows).toHaveLength(1);
    // Validation is what rejects the missing first name, with a message.
    expect(rows[0].lastName).toBe("Cher");
  });

  it("produces a payload the party schema accepts", () => {
    const data = form([
      ["name", "The Smiths"],
      ["email", ""],
      ["tags", "Family, family, work"],
      ["guest.id", ""],
      ["guest.firstName", "Ann"],
      ["guest.lastName", "Smith"],
    ]);

    const parsed = partyFormSchema.safeParse({
      name: String(data.get("name")),
      email: String(data.get("email")),
      phone: "",
      plusOneAllowed: false,
      tags: String(data.get("tags")),
      adminNotes: "",
      guestMessage: "",
      guests: collectGuestRows(data),
    });

    expect(parsed.success).toBe(true);
    // Tags are lowercased and de-duplicated.
    expect(parsed.success && parsed.data.tags).toEqual(["family", "work"]);
  });

  it("rejects a party with no guests", () => {
    const parsed = partyFormSchema.safeParse({
      name: "Empty",
      email: "",
      phone: "",
      plusOneAllowed: false,
      tags: "",
      adminNotes: "",
      guestMessage: "",
      guests: collectGuestRows(form([])),
    });

    expect(parsed.success).toBe(false);
  });
});

describe("collectAdminGuestAnswers", () => {
  it("falls back to the stored status when a field is absent", () => {
    const answers = collectAdminGuestAnswers(
      form([["guest.7.rsvpStatus", "declined"]]),
      [7, 8],
      new Map([
        [7, "both" as const],
        [8, "reception" as const],
      ]),
    );

    expect(answers).toEqual([
      { guestId: 7, rsvpStatus: "declined", dietaryNotes: "" },
      { guestId: 8, rsvpStatus: "reception", dietaryNotes: "" },
    ]);
  });

  it("only answers for the ids it was given, ignoring extras in the body", () => {
    const answers = collectAdminGuestAnswers(
      form([
        ["guest.7.rsvpStatus", "both"],
        ["guest.99.rsvpStatus", "both"],
      ]),
      [7],
      new Map([[7, "pending" as const]]),
    );

    expect(answers.map((answer) => answer.guestId)).toEqual([7]);
  });
});
