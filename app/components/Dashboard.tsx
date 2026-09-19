"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  BUSINESS_TYPES,
  fetchResults,
  markerRadius,
  scoreColor,
  scoreRange,
  type BusinessType,
  type ZipResult,
} from "../lib/supabase";

const ZipMap = dynamic(() => import("./ZipMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const TOP_N = 5;

function MapSkeleton() {
  return (
    <div className="flex h-full w-full animate-pulse items-center justify-center bg-zinc-100 text-sm text-zinc-500">
      Loading map…
    </div>
  );
}

export default function Dashboard() {
  const [type, setType] = useState<BusinessType>("coffee shop");
  const [data, setData] = useState<{ type: BusinessType; results: ZipResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchResults(type)
      .then((results) => !cancelled && setData({ type, results }))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [type]);

  const loading = !error && data?.type !== type;
  const results = data?.results ?? [];
  const { min, max, t } = scoreRange(results);
  const top = results.slice(0, TOP_N);
  const typeLabel = BUSINESS_TYPES.find((b) => b.value === type)!.label;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section className="relative h-[55vh] min-h-80 flex-1 lg:h-auto">
        <ZipMap results={results} selectedZip={selectedZip} onSelect={setSelectedZip} />
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
            <div className="rounded-full bg-white px-4 py-2 text-sm font-medium shadow">
              Loading {typeLabel.toLowerCase()} scores…
            </div>
          </div>
        )}
        {!loading && results.length > 0 && (
          <div className="absolute bottom-4 left-4 z-[1000] w-56 rounded-lg bg-white/95 p-3 text-xs shadow-md">
            <div className="mb-2 font-semibold">Legend</div>
            <div
              className="h-2.5 rounded"
              style={{ background: `linear-gradient(to right, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(1)})` }}
            />
            <div className="mt-1 flex justify-between text-zinc-600">
              <span>{min.toFixed(0)} weaker</span>
              <span>stronger {max.toFixed(0)}</span>
            </div>
            <div className="mt-2 flex items-end gap-2">
              {[0, 0.5, 1].map((v) => (
                <span
                  key={v}
                  className="inline-block rounded-full border border-white"
                  style={{ width: markerRadius(v), height: markerRadius(v), background: scoreColor(v) }}
                />
              ))}
              <span className="text-zinc-600">bigger = higher score</span>
            </div>
            <p className="mt-2 text-zinc-500">
              Score 0–100 = 40% demand + 30% low competition + 30% foot traffic. Click a circle for details.
            </p>
          </div>
        )}
      </section>

      <aside className="flex w-full flex-col border-t border-zinc-200 bg-white lg:w-[400px] lg:border-l lg:border-t-0">
        <div className="border-b border-zinc-200 p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Business type</div>
          <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1">
            {BUSINESS_TYPES.map((b) => (
              <button
                key={b.value}
                role="tab"
                aria-selected={b.value === type}
                onClick={() => {
                  setType(b.value);
                  setSelectedZip(null);
                }}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  b.value === type ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold">
            Top {TOP_N} zips for a {typeLabel.toLowerCase()}
          </h2>
          {error && <p className="mt-3 text-sm text-red-600">Could not load data: {error}</p>}
          {loading && (
            <ol className="mt-3 space-y-3">
              {Array.from({ length: TOP_N }).map((_, i) => (
                <li key={i} className="h-24 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </ol>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="mt-3 text-sm text-zinc-500">No scores yet for this business type.</p>
          )}
          {!loading && (
            <ol className="mt-3 space-y-3">
              {top.map((r, i) => (
                <li key={r.zip}>
                  <button
                    onClick={() => setSelectedZip(r.zip)}
                    className={`w-full rounded-lg border p-3 text-left transition hover:border-zinc-400 ${
                      r.zip === selectedZip ? "border-zinc-900" : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <span className="mr-1.5 text-zinc-400">#{i + 1}</span>
                        <span className="font-semibold">{r.name}</span>
                        <span className="ml-1.5 text-xs text-zinc-500">{r.zip}</span>
                      </div>
                      <span className="text-lg font-bold" style={{ color: scoreColor(t(r.total_score)) }}>
                        {r.total_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-3 text-[11px] text-zinc-500">
                      <span>Demand {r.demand_score.toFixed(0)}</span>
                      <span>Competition {r.competition_score.toFixed(0)}</span>
                      <span>Traffic {r.traffic_score.toFixed(0)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-snug text-zinc-700">
                      {r.insight ?? "Insight not generated yet."}
                    </p>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <footer className="border-t border-zinc-200 p-3 text-[11px] text-zinc-500">
          Data: Census ACS 5-year 2020–2024, Census ZCTA Gazetteer, Google Maps via Apify. Insights by Gemini.
        </footer>
      </aside>
    </div>
  );
}
