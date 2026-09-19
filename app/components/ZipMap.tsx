"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { markerRadius, scoreColor, scoreRange, type ZipResult } from "../lib/supabase";

/** Zoom to the markers once they first arrive; keep the user's view after that. */
function FitToResults({ results }: { results: ZipResult[] }) {
  const map = useMap();
  const hasResults = results.length > 0;
  useEffect(() => {
    if (!hasResults) return;
    map.fitBounds(
      results.map((r) => [r.lat, r.lng] as [number, number]),
      { padding: [40, 40], maxZoom: 13 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hasResults]);
  return null;
}

export default function ZipMap({
  results,
  selectedZip,
  onSelect,
}: {
  results: ZipResult[];
  selectedZip: string | null;
  onSelect: (zip: string) => void;
}) {
  const { t } = scoreRange(results);
  return (
    <MapContainer center={[30.31, -97.735]} zoom={12} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <FitToResults results={results} />
      {results.map((r, i) => {
        const color = scoreColor(t(r.total_score));
        const selected = r.zip === selectedZip;
        return (
          <CircleMarker
            key={r.zip}
            center={[r.lat, r.lng]}
            radius={markerRadius(t(r.total_score))}
            pathOptions={{
              color: selected ? "#111827" : "#ffffff",
              weight: selected ? 3 : 1.5,
              fillColor: color,
              fillOpacity: 0.85,
            }}
            eventHandlers={{ click: () => onSelect(r.zip) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              #{i + 1} {r.zip} · {r.total_score.toFixed(1)}
            </Tooltip>
            <Popup>
              <div className="min-w-44 text-sm">
                <div className="font-semibold">
                  {r.zip} · {r.name}
                </div>
                <div className="mt-1 text-2xl font-bold" style={{ color }}>
                  {r.total_score.toFixed(1)}
                  <span className="text-xs font-normal text-zinc-500"> / 100</span>
                </div>
                <table className="mt-1 w-full text-xs">
                  <tbody>
                    <tr><td>Demand (40%)</td><td className="text-right">{r.demand_score.toFixed(1)}</td></tr>
                    <tr><td>Low competition (30%)</td><td className="text-right">{r.competition_score.toFixed(1)}</td></tr>
                    <tr><td>Foot traffic (30%)</td><td className="text-right">{r.traffic_score.toFixed(1)}</td></tr>
                  </tbody>
                </table>
                <div className="mt-1 text-xs text-zinc-500">
                  {r.competitor_count} competitors in zip · pop {r.population.toLocaleString()}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
