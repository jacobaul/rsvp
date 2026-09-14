import type { ResponsePoint } from "@/lib/rsvp/stats";

/**
 * Cumulative responses over time. Inline SVG rather than a chart library: one
 * series, no interaction needed.
 */
export function Sparkline({
  points,
  total,
}: {
  points: ResponsePoint[];
  total: number;
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted">
        No responses yet. This chart fills in once cards go out.
      </p>
    );
  }

  const width = 640;
  const height = 120;
  const padding = 4;

  const cumulative = points.reduce<{ date: string; value: number }[]>(
    (accumulated, point) => {
      const previous = accumulated[accumulated.length - 1]?.value ?? 0;
      accumulated.push({ date: point.date, value: previous + point.count });
      return accumulated;
    },
    [],
  );

  const runningTotal = cumulative[cumulative.length - 1]?.value ?? 0;
  const max = Math.max(total, runningTotal, 1);
  const lastIndex = Math.max(cumulative.length - 1, 1);

  const coords = cumulative.map((point, index) => {
    const x = padding + (index / lastIndex) * (width - padding * 2);
    const y = height - padding - (point.value / max) * (height - padding * 2);
    return { x, y, ...point };
  });

  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${
    height - padding
  } L${coords[0].x.toFixed(1)},${height - padding} Z`;

  const first = cumulative[0];
  const last = cumulative[cumulative.length - 1];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Cumulative responses: ${last.value} of ${total} parties as of ${last.date}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
      >
        <path d={area} fill="var(--accent)" fillOpacity="0.14" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent-strong)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {coords.length === 1 ? (
          <circle
            cx={coords[0].x}
            cy={coords[0].y}
            r="3"
            fill="var(--accent-strong)"
          />
        ) : null}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-muted">
        <span>{first.date}</span>
        <span>
          {last.value} of {total} parties responded
        </span>
        <span>{last.date}</span>
      </figcaption>
    </figure>
  );
}
