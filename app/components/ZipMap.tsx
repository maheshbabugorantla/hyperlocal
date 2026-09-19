"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Pane, Polygon, Popup, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import {
  FACTORS,
  factorRanks,
  factorHelp,
  type BusinessType,
  scoreColor,
  scoreRange,
  type ZipResult,
} from "../lib/supabase";
import { FactorHelp } from "./FactorHelp";

/** "map" = marker click, "area" = zip outline click, "list" = sidebar click. */
export type SelectSource = "map" | "area" | "list";

type ZipArea = {
  zip: string;
  name: string;
  label: [number, number];
  rings: [number, number][][][]; // polygons -> rings -> [lat, lng]
};

type GeoFeature = {
  properties: { zip: string; name: string; label_lat: number; label_lng: number };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};

function toAreas(fc: { features: GeoFeature[] }): ZipArea[] {
  return fc.features.map((f) => {
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    return {
      zip: f.properties.zip,
      name: f.properties.name,
      label: [f.properties.label_lat, f.properties.label_lng],
      rings: polys.map((poly) => poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]))),
    };
  });
}

/** Load zip outlines at runtime (kept out of the JS bundle). */
function useZipAreas() {
  const [areas, setAreas] = useState<ZipArea[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/austin-zips.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((fc) => !cancelled && setAreas(toAreas(fc)))
      .catch(() => !cancelled && setAreas([])); // markers still work without outlines
    return () => {
      cancelled = true;
    };
  }, []);
  return areas;
}

/**
 * Neighborhood names, always visible. Short names ("South Congress" rather than
 * "South Congress / Bouldin") until zoomed in; lower-ranked labels that would
 * collide with a higher-ranked one are hidden.
 */
const LANDMARKS = new Set(["78701", "78702"]); // Downtown, East Austin

function AreaLabels({ areas, rankOf, topN }: { areas: ZipArea[]; rankOf: Map<string, number>; topN: number }) {
  const map = useMap();
  const [view, setView] = useState(0);
  useEffect(() => {
    const bump = () => setView((v) => v + 1);
    map.on("zoomend moveend resize", bump);
    return () => {
      map.off("zoomend moveend resize", bump);
    };
  }, [map]);

  const zoom = map.getZoom();
  const placed = useMemo(() => {
    void view;
    const full = zoom >= 13;
    // Landmarks everyone knows anchor the map first, then the ranking decides.
    const prio = (z: string) => (z === "78701" ? -1 : LANDMARKS.has(z) ? 0 : (rankOf.get(z) ?? 99));
    const order = [...areas].sort((a, b) => prio(a.zip) - prio(b.zip));
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const out: { area: ZipArea; text: string; dy: number }[] = [];
    for (const a of order) {
      const text = full ? a.name : a.name.split(" / ")[0];
      // top-5 zips carry a numbered marker on the label point; their name sits just under it
      const under = (rankOf.get(a.zip) ?? 99) <= topN;
      const p = map.latLngToContainerPoint(a.label);
      const w = text.length * 6.1 + 6;
      if (under) boxes.push({ x0: p.x - 15, y0: p.y - 15, x1: p.x + 15, y1: p.y + 15 });
      const boxAt = (d: number) => ({ x0: p.x - w / 2, y0: p.y + d - 8, x1: p.x + w / 2, y1: p.y + d + 8 });
      const hits = (b: ReturnType<typeof boxAt>) =>
        boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
      // try the label point first, then nudge down/up a line before giving up
      const dy = (under ? [23] : [0, 13, -13]).find((d) => !hits(boxAt(d)));
      if (dy === undefined) continue;
      boxes.push(boxAt(dy));
      out.push({ area: a, text, dy });
    }
    return out;
  }, [areas, rankOf, topN, map, zoom, view]);

  return (
    <>
      {placed.map(({ area, text, dy }) => (
        <Marker
          key={`${area.zip}:${text}:${dy}`}
          pane="zip-labels"
          position={area.label}
          interactive={false}
          keyboard={false}
          icon={L.divIcon({
            className: dy === 23 ? "zip-label is-under" : "zip-label",
            iconSize: [0, 0],
            html: `<span style="transform:translate(-50%, calc(-50% + ${dy}px))">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`,
          })}
        />
      ))}
    </>
  );
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Zoom to the markers once they first arrive; keep the user's view after that. */
function FitToResults({ results, areas }: { results: ZipResult[]; areas: ZipArea[] | null }) {
  const map = useMap();
  const ready = results.length > 0 && areas !== null;
  useEffect(() => {
    if (!ready) return;
    const pts: [number, number][] = areas!.length
      ? areas!.flatMap((a) => a.rings.flatMap((poly) => poly[0]))
      : results.map((r) => [r.lat, r.lng]);
    map.fitBounds(pts, { padding: [16, 16], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready]);
  return null;
}

/** When a zip is picked from the list, fly to it and open its popup. */
function FlyToSelection({
  results,
  selectedZip,
  source,
  markers,
}: {
  results: ZipResult[];
  selectedZip: string | null;
  source: SelectSource | null;
  markers: React.RefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedZip) {
      map.closePopup();
      return;
    }
    if (source === "map") return;
    const r = results.find((x) => x.zip === selectedZip);
    if (!r) return;
    const target = markers.current.get(selectedZip)?.getLatLng() ?? L.latLng(r.lat, r.lng);
    const zoom = Math.max(map.getZoom(), 12);
    const open = () => markers.current.get(selectedZip)?.openPopup();
    if (reducedMotion()) {
      map.setView(target, zoom, { animate: false });
      open();
    } else {
      map.once("moveend", open);
      map.flyTo(target, zoom, { duration: 0.6, easeLinearity: 0.35 });
    }
    return () => {
      map.off("moveend", open);
    };
    // results identity changes on type switch; we only re-run for a new pick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedZip, source]);
  return null;
}

function ZipMarker({
  r,
  at,
  rank,
  total,
  isTop,
  hot,
  selected,
  t,
  ranks,
  type,
  onHover,
  onSelect,
  onClose,
  registerRef,
}: {
  type: BusinessType;
  r: ZipResult;
  at: [number, number] | undefined;
  rank: number;
  total: number;
  isTop: boolean;
  hot: boolean;
  selected: boolean;
  t: number;
  ranks: Record<(typeof FACTORS)[number]["key"], number> | undefined;
  onHover: (zip: string | null) => void;
  onSelect: (zip: string) => void;
  onClose: (zip: string) => void;
  registerRef: (zip: string, m: L.Marker | null) => void;
}) {
  const size = isTop ? 28 : 0;
  const color = scoreColor(t);
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "zip-marker",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, isTop ? -size / 2 - 2 : 0],
        tooltipAnchor: [0, -size / 2],
        // Only the top 5 get a visible marker; the area fill carries everyone else's score.
        html: isTop ? `<span class="zip-dot is-top" style="background:${color}">${rank}</span>` : "",
      }),
    [size, color, isTop, rank],
  );

  // Toggle the highlight on the live element so the CSS transition can run
  // (swapping the whole icon would remount it already in its end state).
  const markerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    const el = markerRef.current?.getElement()?.querySelector(".zip-dot");
    el?.classList.toggle("is-hot", hot);
  }, [hot, icon]);

  return (
    <Marker
      ref={(m) => {
        markerRef.current = m;
        registerRef(r.zip, m);
      }}
      position={at ?? [r.lat, r.lng]}
      icon={icon}
      title={`#${rank} ${r.name} (${r.zip}), score ${r.total_score.toFixed(1)}`}
      alt={`${r.name} ${r.zip}`}
      zIndexOffset={hot ? 1000 : isTop ? 500 - rank : 0}
      interactive={isTop}
      keyboard={isTop}
      eventHandlers={{
        click: () => onSelect(r.zip),
        mouseover: () => onHover(r.zip),
        mouseout: () => onHover(null),
        popupclose: () => onClose(r.zip),
      }}
    >
      {!selected && isTop && (
      <Tooltip direction="top" opacity={1} className="!rounded-md !border-line-strong !px-2 !py-1 !text-xs !shadow-sm">
        <span className="font-semibold">{r.name}</span>
        <span className="tnum ml-1.5 text-ink-2">{r.total_score.toFixed(1)}</span>
      </Tooltip>
      )}
      <Popup className="hl-popup" closeButton>
        <div className="px-4 pt-3 pb-3.5">
          <div className="tnum text-[11px] font-medium text-ink-3">
            Rank {rank} of {total} · {r.zip}
          </div>
          <div className="mt-0.5 pr-4 text-[15px] font-semibold leading-snug text-ink">{r.name}</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="tnum text-[26px] font-bold leading-none text-ink">{r.total_score.toFixed(1)}</span>
            <span className="text-xs text-ink-3">/ 100</span>
          </div>
          <dl className="mt-3 space-y-1.5">
            {FACTORS.map((f) => (
              <div key={f.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                <dt className="text-xs text-ink-2">
                  <FactorHelp
                    label={
                      <>
                        {f.label} <span className="text-ink-3">×{f.weight}</span>
                      </>
                    }
                    help={factorHelp(f.key, type, r)}
                    weight={f.weight}
                    rank={ranks?.[f.key]}
                    total={total}
                    focusable
                  />
                </dt>
                <dd className="tnum text-xs font-semibold text-ink">
                  {r[f.key].toFixed(0)}
                  {ranks && <span className="ml-1.5 font-normal text-ink-3">#{ranks[f.key]}</span>}
                </dd>
                <div className="col-span-2 h-1 rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${r[f.key]}%` }} />
                </div>
              </div>
            ))}
          </dl>
          <div className="tnum mt-3 border-t border-line pt-2 text-xs text-ink-2">
            {r.competitor_count} {r.competitor_count === 1 ? "competitor" : "competitors"} · {r.population.toLocaleString()} residents
            {r.median_income != null && <> · ${Math.round(r.median_income / 1000)}k median income</>}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function ZipMap({
  results,
  topN,
  hoverZip,
  selectedZip,
  selectSource,
  onHover,
  onSelect,
  type,
}: {
  type: BusinessType;
  results: ZipResult[];
  topN: number;
  hoverZip: string | null;
  selectedZip: string | null;
  selectSource: SelectSource | null;
  onHover: (zip: string | null) => void;
  onSelect: (zip: string | null, source: SelectSource) => void;
}) {
  const { t } = scoreRange(results);
  const ranks = useMemo(() => factorRanks(results), [results]);
  const markers = useRef(new Map<string, L.Marker>());
  const areas = useZipAreas();
  const byZip = useMemo(() => new Map(results.map((r, i) => [r.zip, { r, rank: i + 1 }])), [results]);
  const rankOf = useMemo(() => new Map(results.map((r, i) => [r.zip, i + 1])), [results]);
  const labelAt = useMemo(() => new Map((areas ?? []).map((a) => [a.zip, a.label])), [areas]);
  const selectedRef = useRef(selectedZip);
  useEffect(() => {
    selectedRef.current = selectedZip;
  }, [selectedZip]);

  return (
    <MapContainer
      center={[30.31, -97.735]}
      zoom={12}
      scrollWheelZoom
      zoomSnap={0.25}
      zoomDelta={0.5}
      zoomControl={false}
      className="absolute! inset-0"
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <ZoomControl position="bottomright" />
      <FitToResults results={results} areas={areas} />
      <Pane name="zip-labels" style={{ zIndex: 450, pointerEvents: "none" }} />
      {areas?.map((a) => {
        const hit = byZip.get(a.zip);
        if (!hit) return null;
        const isSel = a.zip === selectedZip;
        const isHover = a.zip === hoverZip;
        return (
          <Polygon
            key={a.zip}
            positions={a.rings}
            pathOptions={{
              fillColor: scoreColor(t(hit.r.total_score)),
              fillOpacity: isSel || isHover ? 0.62 : 0.42,
              color: isSel ? "oklch(0.21 0.018 220)" : isHover ? "oklch(0.34 0.062 204)" : "oklch(1 0 0)",
              weight: isSel ? 2.5 : isHover ? 2 : 1.2,
              opacity: 1,
            }}
            eventHandlers={{
              click: () => onSelect(a.zip, "area"),
              mouseover: () => onHover(a.zip),
              mouseout: () => onHover(null),
            }}
          />
        );
      })}
      {areas && areas.length > 0 && <AreaLabels areas={areas} rankOf={rankOf} topN={topN} />}
      <FlyToSelection results={results} selectedZip={selectedZip} source={selectSource} markers={markers} />
      {results.map((r, i) => (
        <ZipMarker
          // Leaflet doesn't update a marker's title after creation; remount when the rank changes
          key={`${r.zip}:${i}`}
          r={r}
          type={type}
          at={labelAt.get(r.zip)}
          rank={i + 1}
          total={results.length}
          isTop={i < topN}
          hot={r.zip === hoverZip || r.zip === selectedZip}
          selected={r.zip === selectedZip}
          t={t(r.total_score)}
          ranks={ranks.get(r.zip)}
          onHover={onHover}
          onSelect={(zip) => onSelect(zip, "map")}
          onClose={(zip) => {
            if (selectedRef.current === zip) onSelect(null, "map");
          }}
          registerRef={(zip, m) => {
            if (m) markers.current.set(zip, m);
            else markers.current.delete(zip);
          }}
        />
      ))}
    </MapContainer>
  );
}
