"use client";

import dynamic from "next/dynamic";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BUSINESS_TYPES,
  DEMAND_MEANS,
  FACTORS,
  factorRanks,
  factorHelp,
  fetchResults,
  scoreColor,
  scoreRange,
  type BusinessType,
  type FactorKey,
  type ZipResult,
} from "../lib/supabase";
import type { SelectSource } from "./ZipMap";
import ZipDetail, { fieldAverages } from "./ZipDetail";
import { TypeIcon } from "./TypeIcons";
import { FactorHelp } from "./FactorHelp";

const ZipMap = dynamic(() => import("./ZipMap"), {
  ssr: false,
  loading: () => <MapSkeleton label="Loading map" />,
});

const TOP_N = 5;

const NOUN: Record<BusinessType, string> = {
  "coffee shop": "a coffee shop",
  "food truck": "a food truck or pop-up",
  "boutique retail": "a boutique",
  "med spa": "a med spa",
  "tattoo shop": "a tattoo studio",
  laundromat: "a laundromat",
};

function MapSkeleton({ label }: { label: string }) {
  return (
    <div className="skeleton absolute inset-0 flex items-center justify-center">
      <span className="rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-ink-2">
        {label}…
      </span>
    </div>
  );
}

/* ---------------- Insight text: highlight the figures it cites ---------------- */

// $115,213 · 58% · 25,000 · 20–44 · 20 to 44 · 12 · $153k
const NUM = String.raw`\d+(?:,\d{3})*(?:\.\d+)?`;
const FIGURE = new RegExp(
  String.raw`\$${NUM}(?:\s?[kKmM]\b)?|${NUM}(?:\s?(?:–|-|to)\s?${NUM})?%?`,
  "g",
);

function Insight({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(FIGURE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    parts.push(
      <span key={i} className="fig">
        {m[0]}
      </span>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <p className="insight text-[15px] leading-[1.55] text-ink">
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </p>
  );
}

/* ---------------- Factor bars ---------------- */

function FactorBars({
  r,
  ranks,
  total,
  type,
}: {
  type: BusinessType;
  r: ZipResult;
  ranks: Record<FactorKey, number> | undefined;
  total: number;
}) {
  // The factor where this zip stands furthest ahead of the field.
  const standout = ranks ? FACTORS.reduce((a, b) => (ranks[b.key] < ranks[a.key] ? b : a)).key : null;
  return (
    <dl className="grid grid-cols-3 gap-x-4">
      {FACTORS.map((f, i) => {
        const isStandout = f.key === standout;
        return (
          <div key={f.key} className="min-w-0">
            <dt className={`text-[11.5px] leading-tight ${isStandout ? "font-semibold text-ink" : "text-ink-2"}`}>
              <FactorHelp
                label={f.label}
                help={factorHelp(f.key, type, r)}
                weight={f.weight}
                rank={ranks?.[f.key]}
                total={total}
                align={i === FACTORS.length - 1 ? "right" : "left"}
              />
            </dt>
            <dd className="mt-1">
              <div className="h-[5px] rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${isStandout ? "bg-brand-deep" : "bg-brand/55"}`}
                  style={{ width: `${r[f.key]}%` }}
                />
              </div>
              <div className="tnum mt-1 flex items-baseline justify-between text-[11.5px]">
                <span className={isStandout ? "font-semibold text-ink" : "text-ink-2"}>{r[f.key].toFixed(0)}</span>
                {ranks && (
                  <span className={isStandout ? "text-brand-deep" : "text-ink-3"}>
                    {ranks[f.key] === 1 ? "best of " + total : `#${ranks[f.key]} of ${total}`}
                  </span>
                )}
              </div>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ---------------- Dashboard ---------------- */

export default function Dashboard() {
  const [type, setType] = useState<BusinessType>("coffee shop");
  const [data, setData] = useState<{ type: BusinessType; results: ZipResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ zip: string; source: SelectSource } | null>(null);
  const [hoverZip, setHoverZip] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let cancelled = false;
    fetchResults(type)
      .then((results) => {
        if (cancelled) return;
        setError(null);
        setData({ type, results });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [type]);

  const loading = !error && data?.type !== type;
  const results = useMemo(() => data?.results ?? [], [data]);
  const { min, max, t } = scoreRange(results);
  const ranks = useMemo(() => factorRanks(results), [results]);
  const top = results.slice(0, TOP_N);
  const rest = results.slice(TOP_N);
  const selectedZip = selected?.zip ?? null;
  const [expandedZip, setExpandedZip] = useState<string | null>(null);
  const ageAvg = useMemo(() => fieldAverages(results, "age_bands"), [results]);
  const incomeAvg = useMemo(() => fieldAverages(results, "income_brackets"), [results]);
  const typeLabel = BUSINESS_TYPES.find((b) => b.value === type)!.label;

  // A marker click brings its list entry into view.
  useEffect(() => {
    if (!selected || selected.source === "list") return;
    const el = itemRefs.current.get(selected.zip);
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
  }, [selected]);

  const changeType = (next: BusinessType) => {
    if (next === type) return;
    setType(next);
    setSelected(null);
    setExpandedZip(null);
    setHoverZip(null);
  };

  const pickFromList = (zip: string) => setSelected({ zip, source: "list" });

  // Clicking an entry opens its detail (one at a time) and flies the map there.
  const toggle = (zip: string) => {
    if (expandedZip === zip) {
      setExpandedZip(null);
      return;
    }
    setExpandedZip(zip);
    pickFromList(zip);
    requestAnimationFrame(() => {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      itemRefs.current.get(zip)?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
    });
  };
  // Compact rows don't show the written analysis inline, so their panel leads with it.
  const detail = (r: ZipResult, withInsight = false) =>
    expandedZip === r.zip && (
      <ZipDetail
        id={`detail-${r.zip}`}
        insight={withInsight && r.insight ? <Insight text={r.insight} /> : null}
        r={r}
        type={type}
        typeLabel={typeLabel}
        ageAvg={ageAvg}
        incomeAvg={incomeAvg}
      />
    );
  const setItemRef = (zip: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(zip, el);
    else itemRefs.current.delete(zip);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <TypeSelector id="type-mobile" className="lg:hidden" type={type} onChange={changeType} />

      {/* ---------- Map ---------- */}
      <section
        aria-label="Map of scored zip codes"
        className="relative isolate h-[52vh] min-h-[340px] shrink-0 border-b border-line lg:h-auto lg:flex-1 lg:shrink lg:border-b-0"
      >
        {!data && !error ? (
          <MapSkeleton label="Loading scores" />
        ) : (
          <ZipMap
            results={results}
            topN={TOP_N}
            hoverZip={hoverZip}
            selectedZip={selectedZip}
            selectSource={selected?.source ?? null}
            onHover={setHoverZip}
            onSelect={(zip, source) => setSelected(zip ? { zip, source } : null)}
            type={type}
          />
        )}

        {loading && data && (
          <div className="pointer-events-none absolute inset-0 z-[var(--z-map-loading)] flex items-start justify-center bg-bg/45 pt-5">
            <span className="rounded-md border border-line-strong bg-bg px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
              Scoring zips for {NOUN[type]}…
            </span>
          </div>
        )}

        {!loading && !error && data && results.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[var(--z-map-loading)] flex items-start justify-center pt-5">
            <span className="rounded-md border border-line-strong bg-bg px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
              Scores for {typeLabel} are still being computed
            </span>
          </div>
        )}

        {results.length > 0 && (
          <Legend min={min} max={max} />
        )}
      </section>

      {/* ---------- Rankings ---------- */}
      <aside className="flex w-full flex-col bg-panel lg:w-[500px] lg:shrink-0 lg:border-l lg:border-line">
        <TypeSelector id="type-desktop" className="hidden lg:block" type={type} onChange={changeType} />

        <div className="relative flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div className="px-5 pt-5 pb-3">
            <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em] text-balance text-ink">
              <TypeIcon type={type} className="h-6 w-6 shrink-0 text-brand-deep" />
              <span>Five best zips for {NOUN[type]}</span>
            </h2>
            <p className="tnum mt-1 text-[13px] text-ink-2">
              {loading
                ? "Ranking 17 central Austin zips…"
                : !results.length
                  ? "No zips scored yet for this type."
                : results.length < 17
                  ? `${results.length} of 17 zips scored so far; the rest are still being computed.`
                  : `Ranked out of ${results.length}. Scores run ${min.toFixed(0)} to ${max.toFixed(0)}; the analysis below cites the numbers behind each pick.`}
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-2">
              <span className="font-semibold text-ink">Demand here =</span> {DEMAND_MEANS[type]}
            </p>
          </div>

          {error && (
            <div className="mx-5 mb-4 rounded-lg border border-danger/30 bg-bg p-3 text-sm text-danger" role="alert">
              Couldn&apos;t load scores: {error}. Refresh to try again.
            </div>
          )}

          {loading && !error && (
            <ol className="space-y-px" aria-busy="true" aria-label="Loading rankings">
              {Array.from({ length: TOP_N }).map((_, i) => (
                <li key={i} className="bg-bg px-5 py-5">
                  <div className="skeleton h-4 w-2/3 rounded" />
                  <div className="skeleton mt-4 h-2 w-full rounded" />
                  <div className="skeleton mt-4 h-3 w-full rounded" />
                  <div className="skeleton mt-2 h-3 w-5/6 rounded" />
                </li>
              ))}
            </ol>
          )}

          {!loading && !error && results.length === 0 && (
            <p className="flex items-start gap-3 px-5 pb-6 text-sm text-ink-2">
              <TypeIcon type={type} className="h-8 w-8 shrink-0 text-brand" />
              <span>
              Scores for {typeLabel} are still being computed. They appear here automatically once the
              pipeline finishes; switch back to this tab in a few minutes.
              </span>
            </p>
          )}

          {!loading && results.length > 0 && (
            <>
              <ol className="space-y-px">
                {top.map((r, i) => {
                  const isSel = r.zip === selectedZip;
                  const isHover = r.zip === hoverZip;
                  return (
                    <li key={r.zip} ref={setItemRef(r.zip)} className="scroll-my-3">
                      <button
                        type="button"
                        onClick={() => toggle(r.zip)}
                        onMouseEnter={() => setHoverZip(r.zip)}
                        onMouseLeave={() => setHoverZip(null)}
                        onFocus={() => setHoverZip(r.zip)}
                        onBlur={() => setHoverZip(null)}
                        aria-expanded={expandedZip === r.zip}
                        aria-controls={`detail-${r.zip}`}
                        className={`group relative block w-full px-5 pt-4 pb-4 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${
                          isSel ? "bg-brand-wash ring-1 ring-brand/40 ring-inset" : isHover ? "bg-brand-wash/60" : "bg-bg"
                        }`}
                      >
                        <span className="flex items-start gap-3.5">
                          <span
                            aria-hidden
                            className="tnum mt-[3px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                            style={{ background: scoreColor(t(r.total_score)) }}
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block text-[16px] font-semibold leading-snug text-balance text-ink">
                                  {r.name}
                                </span>
                                <span className="tnum mt-0.5 block text-[12px] text-ink-3">
                                  {r.zip} · {r.competitor_count} {r.competitor_count === 1 ? "competitor" : "competitors"} · {r.population.toLocaleString()} residents
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="tnum block text-[24px] leading-none font-bold tracking-[-0.02em] text-ink">
                                  {r.total_score.toFixed(1)}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-ink-3">score</span>
                              </span>
                            </span>

                            <span className="mt-2.5 block">
                              {r.insight ? (
                                <Insight text={r.insight} />
                              ) : (
                                <span className="insight block text-[14px] text-ink-2 italic">
                                  Written analysis isn&apos;t available for this zip yet.
                                </span>
                              )}
                            </span>

                            <span className="mt-3 block border-t border-line pt-2.5">
                              <FactorBars r={r} ranks={ranks.get(r.zip)} total={results.length} type={type} />
                            </span>
                            <span className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-deep">
                              {expandedZip === r.zip ? "Hide detail" : "Residents, income, vibe, competitors"}
                              <Chevron open={expandedZip === r.zip} />
                            </span>
                          </span>
                        </span>
                      </button>
                      {detail(r)}
                    </li>
                  );
                })}
              </ol>

              {rest.length > 0 && (
                <section className="px-5 pt-6 pb-4" aria-labelledby="rest-heading">
                  <h3 id="rest-heading" className="text-[13px] font-semibold text-ink-2">
                    The other {rest.length}, by score
                  </h3>
                  <ol className="mt-2 divide-y divide-line border-y border-line" start={TOP_N + 1}>
                    {rest.map((r, i) => {
                      const isSel = r.zip === selectedZip;
                      const isHover = r.zip === hoverZip;
                      return (
                        <li key={r.zip} ref={setItemRef(r.zip)}>
                          <button
                            type="button"
                            onClick={() => toggle(r.zip)}
                            onMouseEnter={() => setHoverZip(r.zip)}
                            onMouseLeave={() => setHoverZip(null)}
                            onFocus={() => setHoverZip(r.zip)}
                            onBlur={() => setHoverZip(null)}
                            aria-expanded={expandedZip === r.zip}
                            aria-controls={`detail-${r.zip}`}
                            className={`grid w-full grid-cols-[1.75rem_1fr_2.75rem_1rem] sm:grid-cols-[1.75rem_1fr_4.5rem_2.75rem_1rem] items-center gap-2 py-2 pr-1 text-left text-[13px] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                              isSel ? "bg-brand-tint" : isHover ? "bg-bg" : ""
                            }`}
                          >
                            <span className="tnum pl-1 text-ink-3">{i + TOP_N + 1}</span>
                            <span className="min-w-0 truncate text-ink">
                              {r.name} <span className="tnum text-ink-3">{r.zip}</span>
                            </span>
                            <span className="hidden h-1 rounded-full bg-line sm:block" aria-hidden>
                              <span
                                className="block h-full rounded-full bg-ink-3/60"
                                style={{ width: `${r.total_score}%` }}
                              />
                            </span>
                            <span className="tnum text-right font-medium text-ink-2">{r.total_score.toFixed(1)}</span>
                            <Chevron open={expandedZip === r.zip} />
                          </button>
                          {detail(r, true)}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}
            </>
          )}

          <footer className="px-5 pt-2 pb-6 text-[11.5px] leading-relaxed text-ink-3">
            <p>
              <span className="font-medium text-ink-2">Sources.</span> Population, age and income: Census ACS
              5-year, 2020–2024. Zip centroids: Census ZCTA Gazetteer. Competitors and foot traffic: Google Maps
              via the Apify scraper. Written analysis: Gemini, from these figures.
            </p>
          </footer>
        </div>
      </aside>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 text-brand-deep transition-transform duration-200 ease-out-quart motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- Business type selector ---------------- */

function TypeSelector({
  id,
  className,
  type,
  onChange,
}: {
  id: string;
  className: string;
  type: BusinessType;
  onChange: (t: BusinessType) => void;
}) {
  return (
    <div className={`border-b border-line bg-bg px-5 pt-3.5 pb-4 lg:pt-4 ${className}`}>
      <div id={id} className="text-[13px] font-medium text-ink-2">
        What are you opening?
      </div>
      <div
        role="tablist"
        aria-labelledby={id}
        className="mt-2 grid grid-cols-3 gap-[3px] rounded-lg border border-line-strong bg-panel p-[3px]"
      >
        {BUSINESS_TYPES.map((b) => {
          const active = b.value === type;
          return (
            <button
              key={b.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(b.value)}
              className={`type-tab flex flex-col items-center justify-center gap-1 rounded-md px-1.5 py-2 text-center text-[12.5px] leading-tight font-semibold lg:flex-row lg:gap-1.5 lg:px-1.5 lg:text-left lg:whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
                active ? "bg-brand-deep text-white shadow-sm" : "text-ink-2 hover:bg-bg hover:text-ink"
              }`}
            >
              <TypeIcon type={b.value} className="h-[22px] w-[22px] shrink-0" />
              <span>{b.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Legend ---------------- */

function Legend({ min, max }: { min: number; max: number }) {
  return (
    <div className="absolute top-3 left-3 z-[var(--z-map-overlay)] w-[228px] rounded-lg border border-line-strong bg-bg/95 px-3.5 py-3 text-[11.5px] leading-snug text-ink-2 shadow-[0_1px_3px_oklch(0.2_0.02_220/0.1)] max-sm:w-[176px] max-sm:px-3 max-sm:py-2.5">
      <div className="text-[12px] font-semibold text-ink">Opportunity score</div>
      <div className="mt-0.5 max-sm:hidden">Each zip is shaded by its score</div>
      <div
        className="mt-2 h-2.5 rounded-[3px] opacity-80"
        style={{ background: `linear-gradient(to right, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(1)})` }}
      />
      <div className="tnum mt-1 flex justify-between">
        <span>{min.toFixed(0)} weaker</span>
        <span>stronger {max.toFixed(0)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 max-sm:hidden">
        <span
          className="tnum inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
          style={{ background: scoreColor(1) }}
        >
          1
        </span>
        <span>Top 5, with written analysis</span>
      </div>
      <p className="mt-2 border-t border-line pt-2 max-sm:hidden">
        40% demand + 30% low competition + 30% foot traffic, each 0–100.
      </p>
    </div>
  );
}
