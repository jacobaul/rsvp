import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { buildQrZip, renderQrPng, renderQrSvg, slugify } from "../qr";

describe("slugify", () => {
  it("makes a filesystem-safe name", () => {
    expect(slugify("The Aulenback Family")).toBe("the-aulenback-family");
    expect(slugify("Lee, Dana & Kit")).toBe("lee-dana-kit");
    expect(slugify("  ")).toBe("party");
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
  });

  it("caps the length", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe("renderQrSvg", () => {
  it("encodes the URL as path data, never as markup", async () => {
    // The URL is admin-controlled, and the SVG is inlined with
    // dangerouslySetInnerHTML, so it must never reach the output as text.
    const hostile =
      'https://example.test/rsvp/AAAA-AAAA?"></svg><script>alert(1)</script>';
    const svg = await renderQrSvg(hostile);

    expect(svg).not.toContain("script");
    expect(svg).not.toContain("alert");
    expect(svg).not.toContain("example.test");

    // Only drawing primitives survive: the URL becomes path geometry.
    const elements = new Set(
      [...svg.matchAll(/<(\w+)/g)].map((match) => match[1]),
    );
    expect([...elements].sort()).toEqual(["path", "svg"]);
  });

  it("produces a scannable-sized square", async () => {
    const svg = await renderQrSvg("https://example.test/rsvp/AAAA-AAAA");
    expect(svg).toMatch(/viewBox="0 0 (\d+) \1"/);
  });
});

describe("renderQrPng", () => {
  it("returns a PNG buffer", async () => {
    const png = await renderQrPng("https://example.test/rsvp/AAAA-AAAA", 256);
    // PNG magic number.
    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(png.byteLength).toBeGreaterThan(100);
  });
});

describe("buildQrZip", () => {
  it("bundles an SVG and PNG per party plus a manifest", async () => {
    const zip = await buildQrZip([
      {
        partyName: "The Smiths",
        formattedCode: "ABCD-EFGH",
        url: "https://example.test/rsvp/ABCD-EFGH",
      },
      {
        partyName: "Lee, Dana & Kit",
        formattedCode: "JKLM-NPQR",
        url: "https://example.test/rsvp/JKLM-NPQR",
      },
    ]);

    const files = unzipSync(zip);
    const names = Object.keys(files).sort();

    expect(names).toEqual([
      "manifest.csv",
      "png/lee-dana-kit__JKLM-NPQR.png",
      "png/the-smiths__ABCD-EFGH.png",
      "svg/lee-dana-kit__JKLM-NPQR.svg",
      "svg/the-smiths__ABCD-EFGH.svg",
    ]);

    const manifest = strFromU8(files["manifest.csv"]);
    expect(manifest).toContain("party,code,url,svg_file,png_file");
    expect(manifest).toContain("ABCD-EFGH");
    // A party name containing a comma must be quoted.
    expect(manifest).toContain('"Lee, Dana & Kit"');
  });

  it("handles an empty list", async () => {
    const files = unzipSync(await buildQrZip([]));
    expect(Object.keys(files)).toEqual(["manifest.csv"]);
  });
});
