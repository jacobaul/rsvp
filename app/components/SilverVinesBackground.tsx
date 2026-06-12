import Image from "next/image";

export function SilverVinesBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/*
        Each vine anchors the ORIGINAL SVG's bottom edge to a screen side.
        The zero-size wrapper pins a screen corner; the image is placed so its
        bottom corner sits exactly on that corner, then rotated about that same
        corner (transform-origin = that corner, no translate). Because nothing
        is translated by the image's own size, changing the height only grows
        the art toward the center — the pinned side edge never moves.
      */}

      {/* Left: original bottom edge runs down the LEFT viewport edge (+90deg).
          Anchored low so the vine sits toward the bottom of the page. */}
      <div className="absolute left-0 top-1/2 h-0 w-0">
        <Image
          src="/SilverVinesBackground.svg"
          alt=""
          width={768}
          height={1024}
          unoptimized
          className="absolute bottom-0 left-0 block h-[46rem] w-auto max-w-none opacity-60 blur-[0.2px]"
          style={{ transformOrigin: "left bottom", transform: "rotate(90deg)" }}
        />
      </div>

      {/* Right: original bottom edge runs down the RIGHT viewport edge (-90deg).
          Anchored high so the vine sits toward the top of the page. */}
      <div className="absolute right-0 top-0 h-0 w-0">
        <Image
          src="/SilverVinesBackground.svg"
          alt=""
          width={768}
          height={1024}
          unoptimized
          className="absolute bottom-0 right-0 block h-[44rem] w-auto max-w-none opacity-52 blur-[0.15px]"
          style={{ transformOrigin: "right bottom", transform: "rotate(-90deg)" }}
        />
      </div>
    </div>
  );
}