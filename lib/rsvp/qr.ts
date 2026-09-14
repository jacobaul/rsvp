import "server-only";

import { zipSync, strToU8 } from "fflate";
import QRCode from "qrcode";

const QR_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 4,
};

export async function renderQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    ...QR_OPTIONS,
    type: "svg",
    color: { dark: "#203126", light: "#ffffff" },
  });
}

export async function renderQrPng(
  url: string,
  width = 1024,
): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    ...QR_OPTIONS,
    type: "png",
    width,
    color: { dark: "#203126", light: "#ffffff" },
  });
}

/** Filesystem-safe slug for QR filenames. */
export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "party";
}

export type QrBundleEntry = {
  partyName: string;
  formattedCode: string;
  url: string;
};

/**
 * One SVG and one PNG per party, named `slug__CODE` so the print shop can
 * match a file back to a party at a glance.
 */
export async function buildQrZip(entries: QrBundleEntry[]): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};

  for (const entry of entries) {
    const base = `${slugify(entry.partyName)}__${entry.formattedCode}`;
    const [svg, png] = await Promise.all([
      renderQrSvg(entry.url),
      renderQrPng(entry.url),
    ]);

    files[`svg/${base}.svg`] = strToU8(svg);
    files[`png/${base}.png`] = new Uint8Array(png);
  }

  const manifest = [
    "party,code,url,svg_file,png_file",
    ...entries.map((entry) => {
      const base = `${slugify(entry.partyName)}__${entry.formattedCode}`;
      const name = `"${entry.partyName.replace(/"/g, '""')}"`;
      return `${name},${entry.formattedCode},${entry.url},svg/${base}.svg,png/${base}.png`;
    }),
  ].join("\n");

  files["manifest.csv"] = strToU8(manifest);

  return zipSync(files, { level: 6 });
}
