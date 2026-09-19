"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import {
  FACTORS,
  factorRanks,
  markerSize,
  scoreColor,
  scoreRange,
  type ZipResult,
} from "../lib/supabase";

export type SelectSource = "map" | "list";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Zoom to the markers once they first arrive; keep the user's view after that. */
function FitToResults({ results }: { results: ZipResult[] }) {
  const map = useMap();
  const hasResults = results.length > 0;
  useEffect(() => {
    if (!hasResults) return;
    map.fitBounds(
      results.map((r) => [r.lat, r.lng] as [number, number]),
      { padding: [48, 48], maxZoom: 13 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hasResults]);
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
    if (source !== "list") return;
    const r = results.find((x) => x.zip === selectedZip);
    if (!r) return;
    const target: [number, number] = [r.lat, r.lng];
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
  rank,
  total,
  isTop,
  hot,
  selected,
  t,
  ranks,
  onHover,
  onSelect,
  onClose,
  registerRef,
}: {
  r: ZipResult;
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
  const size = markerSize(t);
  const color = scoreColor(t);
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "zip-marker",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 - 2],
        tooltipAnchor: [0, -size / 2],
        html: `<span class="zip-dot ${isTop ? "is-top" : "is-rest"}" style="background:${color}">${
          isTop ? rank : ""
        }</span>`,
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
      position={[r.lat, r.lng]}
      icon={icon}
      title={`#${rank} ${r.name} (${r.zip}), score ${r.total_score.toFixed(1)}`}
      alt={`${r.name} ${r.zip}`}
      zIndexOffset={hot ? 1000 : isTop ? 500 - rank : 0}
      eventHandlers={{
        click: () => onSelect(r.zip),
        mouseover: () => onHover(r.zip),
        mouseout: () => onHover(null),
        popupclose: () => onClose(r.zip),
      }}
    >
      {!selected && (
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
                  {f.label} <span className="text-ink-3">×{f.weight}</span>
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
}: {
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
  const selectedRef = useRef(selectedZip);
  useEffect(() => {
    selectedRef.current = selectedZip;
  }, [selectedZip]);

  return (
    <MapContainer
      center={[30.31, -97.735]}
      zoom={12}
      scrollWheelZoom
      zoomControl={false}
      className="absolute! inset-0"
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <ZoomControl position="bottomright" />
      <FitToResults results={results} />
      <FlyToSelection results={results} selectedZip={selectedZip} source={selectSource} markers={markers} />
      {results.map((r, i) => (
        <ZipMarker
          // Leaflet doesn't update a marker's title after creation; remount when the rank changes
          key={`${r.zip}:${i}`}
          r={r}
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
