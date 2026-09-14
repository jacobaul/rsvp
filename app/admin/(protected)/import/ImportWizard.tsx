"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { previewImport, runImport } from "../../actions/import";
import {
  initialImportState,
  type ImportState,
} from "../../actions/import-state";
import {
  Card,
  buttonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "../../components/ui";

export function ImportWizard({ template }: { template: string }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(
    previewImport,
    initialImportState,
  );

  if (state.step === "preview" && state.plan) {
    return <PreviewStep state={state} />;
  }

  if (state.step === "done" && state.summary) {
    return (
      <Card>
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-foreground">
          Import complete
        </h2>
        <ul className="mt-4 flex flex-col gap-1 text-sm text-foreground">
          <li>{state.summary.created} parties created</li>
          <li>{state.summary.updated} parties updated</li>
          <li>{state.summary.skipped} skipped</li>
          <li>{state.summary.guestsAdded} guests added</li>
          {state.summary.guestsRemoved > 0 ? (
            <li>{state.summary.guestsRemoved} guests removed</li>
          ) : null}
          <li>{state.summary.codesAssigned} new codes generated</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin/parties" className={buttonClass}>
            View parties
          </Link>
          <Link href="/admin/qr" className={secondaryButtonClass}>
            Generate QR codes
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-3 text-sm uppercase tracking-[0.25em] text-muted">
          1. Provide the list
        </h2>

        <p className="mb-4 text-sm leading-6 text-muted">
          One row per guest. Rows sharing a <code>party</code> value become one
          invitation with one code. Leave <code>code</code> blank to generate
          one; fill it in to keep a code that is already printed.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="file" className={labelClass}>
              Upload a CSV file
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              className={`${inputClass} mt-1 file:mr-3 file:border-0 file:bg-accent file:px-3 file:py-1 file:text-white`}
            />
          </div>

          <p className="text-xs uppercase tracking-[0.2em] text-muted">or</p>

          <div>
            <label htmlFor="csv" className={labelClass}>
              Paste CSV
            </label>
            <textarea
              id="csv"
              name="csv"
              rows={10}
              defaultValue={state.csv}
              placeholder={template}
              spellCheck={false}
              className={`${inputClass} mt-1 resize-y font-mono text-xs`}
            />
          </div>
        </div>
      </Card>

      {state.message ? (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      {state.errors && state.errors.length > 0 ? (
        <Card className="border-red-300">
          <h3 className="mb-2 text-sm font-semibold text-red-800">
            {state.errors.length} problem
            {state.errors.length === 1 ? "" : "s"} found
          </h3>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm text-red-800">
            {state.errors.map((error, index) => (
              <li key={index}>
                {error.line > 0 ? `Row ${error.line}: ` : ""}
                {error.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Checking…" : "Preview import"}
        </button>
      </div>
    </form>
  );
}

function PreviewStep({ state }: { state: ImportState }) {
  const [commitState, commitAction, pending] = useActionState<
    ImportState,
    FormData
  >(runImport, state);
  const [mode, setMode] = useState("skip");

  if (commitState.step === "done" && commitState.summary) {
    return (
      <Card>
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-foreground">
          Import complete
        </h2>
        <ul className="mt-4 flex flex-col gap-1 text-sm text-foreground">
          <li>{commitState.summary.created} parties created</li>
          <li>{commitState.summary.updated} parties updated</li>
          <li>{commitState.summary.skipped} skipped</li>
          <li>{commitState.summary.guestsAdded} guests added</li>
          {commitState.summary.guestsRemoved > 0 ? (
            <li>{commitState.summary.guestsRemoved} guests removed</li>
          ) : null}
          <li>{commitState.summary.codesAssigned} new codes generated</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin/parties" className={buttonClass}>
            View parties
          </Link>
          <Link href="/admin/qr" className={secondaryButtonClass}>
            Generate QR codes
          </Link>
        </div>
      </Card>
    );
  }

  const plan = state.plan!;

  return (
    <form action={commitAction} className="flex flex-col gap-6">
      <input type="hidden" name="csv" value={state.csv ?? ""} />

      <Card>
        <h2 className="mb-3 text-sm uppercase tracking-[0.25em] text-muted">
          2. Review
        </h2>

        <p className="text-sm text-muted">
          Read {state.rowCount} row{state.rowCount === 1 ? "" : "s"}.{" "}
          {plan.toCreate.length} new, {plan.conflicts.length} already exist,{" "}
          {plan.codeCollisions.length} blocked.
        </p>

        {state.errors && state.errors.length > 0 ? (
          <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">
              {state.errors.length} row
              {state.errors.length === 1 ? "" : "s"} will be skipped
            </p>
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {state.errors.map((error, index) => (
                <li key={index}>
                  {error.line > 0 ? `Row ${error.line}: ` : ""}
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {plan.toCreate.length > 0 ? (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            New parties ({plan.toCreate.length})
          </h3>
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto text-sm">
            {plan.toCreate.map((party, index) => (
              <li key={index} className="border-b border-accent/15 pb-2 last:border-0">
                <span className="font-medium text-foreground">{party.name}</span>
                <span className="ml-2 text-muted">
                  {party.guests.join(", ")}
                </span>
                {party.code ? (
                  <span className="ml-2 font-mono text-xs text-muted">
                    code {party.code}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {plan.codeCollisions.length > 0 ? (
        <Card className="border-red-300">
          <h3 className="mb-3 text-sm font-semibold text-red-800">
            Blocked: code already belongs to another party
          </h3>
          <ul className="flex flex-col gap-1 text-sm text-red-800">
            {plan.codeCollisions.map((collision, index) => (
              <li key={index}>
                {collision.name} — code is in use by {collision.ownerName}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-800">
            These rows are skipped. Clear the code column for them, or fix the
            conflict first.
          </p>
        </Card>
      ) : null}

      {plan.conflicts.length > 0 ? (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Already exist ({plan.conflicts.length})
          </h3>
          <ul className="mb-4 flex max-h-56 flex-col gap-2 overflow-y-auto text-sm">
            {plan.conflicts.map((conflict, index) => (
              <li key={index} className="border-b border-accent/15 pb-2 last:border-0">
                <Link
                  href={`/admin/parties/${conflict.existingId}`}
                  className="font-medium text-accent-strong underline underline-offset-4"
                >
                  {conflict.name}
                </Link>
                <span className="ml-2 text-muted">
                  {conflict.guests.join(", ")}
                </span>
              </li>
            ))}
          </ul>

          <fieldset>
            <legend className={labelClass}>What should happen to these?</legend>
            <div className="mt-2 flex flex-col gap-2 text-sm">
              {[
                {
                  value: "skip",
                  label: "Skip them",
                  hint: "Leave existing parties completely untouched.",
                },
                {
                  value: "update",
                  label: "Update details, add missing guests",
                  hint: "Keeps codes and any answers already given.",
                },
                {
                  value: "replace",
                  label: "Replace their guest list",
                  hint: "Deletes named guests not in the file, losing their answers.",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => setMode(option.value)}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="text-foreground">{option.label}</span>
                    <span className="block text-xs text-muted">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Card>
      ) : (
        <input type="hidden" name="mode" value="skip" />
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass}
          onClick={(event) => {
            if (
              mode === "replace" &&
              plan.conflicts.length > 0 &&
              !confirm(
                "Replacing guest lists deletes guests not in the file, along with any answers they gave. Continue?",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          {pending ? "Importing…" : "Run import"}
        </button>
        <Link href="/admin/import" className={secondaryButtonClass}>
          Start over
        </Link>
      </div>
    </form>
  );
}
