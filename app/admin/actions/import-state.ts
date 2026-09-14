import type { ImportPlan, ImportSummary } from "@/lib/rsvp/import";
import type { RowError } from "@/lib/rsvp/csv-import";

/** Kept out of the `"use server"` file, which may only export async functions. */
export type ImportState = {
  step: "input" | "preview" | "done";
  csv?: string;
  errors?: RowError[];
  rowCount?: number;
  plan?: {
    toCreate: { name: string; guests: string[]; code: string }[];
    conflicts: { name: string; guests: string[]; existingId: number }[];
    codeCollisions: { name: string; ownerName: string }[];
  };
  summary?: ImportSummary;
  message?: string;
};

export const initialImportState: ImportState = { step: "input" };

export function summarizePlan(plan: ImportPlan): ImportState["plan"] {
  return {
    toCreate: plan.toCreate.map((party) => ({
      name: party.name,
      guests: party.guests.map((g) => `${g.firstName} ${g.lastName}`.trim()),
      code: party.code,
    })),
    conflicts: plan.conflicts.map((conflict) => ({
      name: conflict.parsed.name,
      guests: conflict.parsed.guests.map((g) =>
        `${g.firstName} ${g.lastName}`.trim(),
      ),
      existingId: conflict.existingId,
    })),
    codeCollisions: plan.codeCollisions.map((collision) => ({
      name: collision.parsed.name,
      ownerName: collision.ownerName,
    })),
  };
}
