import { parse } from "csv-parse/sync";

import {
  importRowSchema,
  type ImportRow,
  IMPORT_COLUMNS,
} from "@/lib/validation/import";

export type RowError = {
  line: number;
  message: string;
};

export type ParsedParty = {
  name: string;
  email: string;
  phone: string;
  plusOnesAllowed: number;
  tags: string[];
  adminNotes: string;
  code: string;
  guests: { firstName: string; lastName: string }[];
  lines: number[];
};

export type ParseResult = {
  parties: ParsedParty[];
  errors: RowError[];
  rowCount: number;
};

function splitTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[;,]/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

/**
 * One row per guest, grouped by the `party` column. Party-level values
 * (email, plus one, tags, code) are taken from the first row of each group;
 * later rows only add guests.
 */
export function parseImportCsv(input: string): ParseResult {
  const errors: RowError[] = [];

  let records: Record<string, string>[];

  try {
    records = parse(input, {
      columns: (header: string[]) =>
        header.map((name) => name.trim().toLowerCase().replace(/\s+/g, "_")),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
  } catch (error) {
    return {
      parties: [],
      rowCount: 0,
      errors: [
        {
          line: 0,
          message: `Could not read the CSV: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        },
      ],
    };
  }

  if (records.length === 0) {
    return {
      parties: [],
      rowCount: 0,
      errors: [{ line: 0, message: "The file has no data rows." }],
    };
  }

  const headerKeys = Object.keys(records[0] ?? {});
  const missing = ["party", "first_name"].filter(
    (column) => !headerKeys.includes(column),
  );

  if (missing.length > 0) {
    return {
      parties: [],
      rowCount: records.length,
      errors: [
        {
          line: 1,
          message: `Missing required column(s): ${missing.join(
            ", ",
          )}. Expected header: ${IMPORT_COLUMNS.join(", ")}`,
        },
      ],
    };
  }

  const byParty = new Map<string, ParsedParty>();
  const seenCodes = new Map<string, string>();

  records.forEach((record, index) => {
    // +2: one for the header row, one for 1-based numbering.
    const line = index + 2;
    const parsed = importRowSchema.safeParse(record);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ line, message: issue.message });
      }
      return;
    }

    const row: ImportRow = parsed.data;
    const key = row.party.toLowerCase();
    const existing = byParty.get(key);

    if (existing) {
      existing.guests.push({
        firstName: row.first_name,
        lastName: row.last_name,
      });
      existing.lines.push(line);

      // Later rows may raise the allowance; take the largest seen.
      const rowAllowance = Math.max(
        row.plus_ones_allowed,
        row.plus_one_allowed,
      );

      if (rowAllowance > existing.plusOnesAllowed) {
        existing.plusOnesAllowed = rowAllowance;
      }

      if (!existing.email && row.email) {
        existing.email = row.email;
      }

      return;
    }

    if (row.code) {
      const owner = seenCodes.get(row.code);

      if (owner && owner !== key) {
        errors.push({
          line,
          message: `Code ${row.code} is used by more than one party in this file.`,
        });
        return;
      }

      seenCodes.set(row.code, key);
    }

    byParty.set(key, {
      name: row.party,
      email: row.email,
      phone: row.phone,
      plusOnesAllowed: Math.max(row.plus_ones_allowed, row.plus_one_allowed),
      tags: splitTags(row.tags),
      adminNotes: row.notes,
      code: row.code,
      guests: [{ firstName: row.first_name, lastName: row.last_name }],
      lines: [line],
    });
  });

  return {
    parties: Array.from(byParty.values()),
    errors,
    rowCount: records.length,
  };
}

export const IMPORT_TEMPLATE = `party,first_name,last_name,plus_ones_allowed,email,phone,tags,notes,code
The Aulenback Family,Robert,Aulenback,0,robert@example.com,,groom-family,,
The Aulenback Family,Susan,Aulenback,0,,,groom-family,,
Sam Rivera,Sam,Rivera,2,,,work,Met at the conference,
`;

