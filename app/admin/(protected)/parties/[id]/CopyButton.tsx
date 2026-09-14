"use client";

import { useState } from "react";

import { secondaryButtonClass } from "../../../components/ui";

export function CopyButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={secondaryButtonClass}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard is unavailable over plain http on some browsers.
          window.prompt("Copy this:", value);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
