"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";

const venue = {
  name: "Esquimalt Gorge Pavilion",
  address: "1070 Tillicum Rd, Victoria, BC",
  mapHref: "https://maps.app.goo.gl/veZERSgR99bXjwLy8",
  center: { lat: 48.446657064899625, lng: -123.4047782421112 },
};

let mapsOptionsConfigured = false;

export function TravelMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setLoadError(true);
      return;
    }

    if (!mapRef.current) {
      return;
    }

    let cancelled = false;

    async function initializeMap() {
      try {
        if (!mapsOptionsConfigured) {
          setOptions({
            key: apiKey,
            v: "weekly",
          });
          mapsOptionsConfigured = true;
        }

        const { Map } = await importLibrary("maps");

        if (cancelled || !mapRef.current) {
          return;
        }

        const map = new Map(mapRef.current, {
          center: venue.center,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapId: "cb04df4115ba28f486c30333",
        });
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="border border-accent/25 bg-card px-8 py-10 sm:px-10 sm:py-12">
        <p className="text-sm uppercase tracking-[0.45em] text-accent">Map Coming Soon</p>
        <p className="mt-6 font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
          Travel directions will appear here.
        </p>
        <p className="mt-6 max-w-lg text-base leading-8 text-muted">
          A map for Esquimalt Gorge Pavilion will be available here soon.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-accent/25 bg-card">
      <div ref={mapRef} className="aspect-[4/5] w-full min-h-[26rem]" />
      <div className="border-t border-accent/15 px-6 py-5 sm:px-8">
        <a
          href={venue.mapHref}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-base leading-7 text-muted "
        >
          View on Google Maps
        </a>
      </div>
    </div>
  );
}