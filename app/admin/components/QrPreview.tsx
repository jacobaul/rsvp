import { renderQrSvg } from "@/lib/rsvp/qr";

/**
 * Inlines the QR as SVG markup. The generator's output is a fixed template
 * built from the URL's encoded modules, not arbitrary user HTML.
 */
export async function QrPreview({
  url,
  size = 180,
  className = "",
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const svg = await renderQrSvg(url);
  const sized = svg.replace(
    "<svg",
    `<svg width="${size}" height="${size}" role="img" aria-label="QR code linking to this party's RSVP page"`,
  );

  return (
    <div
      className={`inline-block bg-white p-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: sized }}
    />
  );
}
