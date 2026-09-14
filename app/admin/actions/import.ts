"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { parseImportCsv } from "@/lib/rsvp/csv-import";
import { commitImport, planImport } from "@/lib/rsvp/import";
import { CONFLICT_MODES, type ConflictMode } from "@/lib/validation/import";

import { summarizePlan, type ImportState } from "./import-state";

const MAX_CSV_BYTES = 1_000_000;

async function readCsv(formData: FormData): Promise<string | null> {
  const file = formData.get("file");

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_BYTES) {
      return null;
    }

    return file.text();
  }

  const pasted = String(formData.get("csv") ?? "");

  if (pasted.length > MAX_CSV_BYTES) {
    return null;
  }

  return pasted;
}

export async function previewImport(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();

  const csv = await readCsv(formData);

  if (csv === null) {
    return {
      step: "input",
      message: "That file is too large. Split it into smaller batches.",
    };
  }

  if (!csv.trim()) {
    return { step: "input", message: "Paste some CSV or choose a file." };
  }

  const parsed = parseImportCsv(csv);

  if (parsed.parties.length === 0) {
    return {
      step: "input",
      csv,
      errors: parsed.errors,
      rowCount: parsed.rowCount,
      message: "Nothing could be imported. Fix the problems below and retry.",
    };
  }

  const plan = await planImport(parsed.parties);

  return {
    step: "preview",
    csv,
    errors: parsed.errors,
    rowCount: parsed.rowCount,
    plan: summarizePlan(plan),
  };
}

export async function runImport(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();

  const csv = String(formData.get("csv") ?? "");
  const modeValue = String(formData.get("mode") ?? "skip");
  const mode = (
    CONFLICT_MODES.includes(modeValue as ConflictMode) ? modeValue : "skip"
  ) as ConflictMode;

  if (!csv.trim()) {
    return { step: "input", message: "The import data was lost. Start again." };
  }

  const parsed = parseImportCsv(csv);

  if (parsed.parties.length === 0) {
    return {
      step: "input",
      errors: parsed.errors,
      message: "Nothing could be imported.",
    };
  }

  // Re-plan at commit time: the database may have changed since the preview.
  const plan = await planImport(parsed.parties);
  const summary = await commitImport(plan, mode);

  revalidatePath("/admin/parties");
  revalidatePath("/admin");

  return { step: "done", summary };
}
