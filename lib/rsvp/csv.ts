import { stringify } from "csv-stringify/sync";

/**
 * Excel and Sheets treat a leading = + - @ as a formula. Prefixing with a
 * quote keeps an imported value inert.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    return `'${text}`;
  }

  return text;
}

export function toCsv(
  columns: string[],
  rows: (string | number | null | undefined)[][],
): string {
  return stringify([columns, ...rows.map((row) => row.map(escapeCsvValue))], {
    bom: true,
  });
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
