"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DEMAND_MEANS, fetchCompetitors, type Band, type BusinessType, type Competitor, type ZipResult } from "../lib/supabase";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function shares(b: Band[]) {
  const total = b.reduce((s, x) => s + x.count, 0);
  return total > 0 ? b.map((x) => x.count / total) : b.map(() => 0);
}

/** Mean share per band across every zip that has the data. */
export function fieldAverages(results: ZipResult[], key: "age_bands" | "income_brackets") {
  const rows = results.map((r) => r[key]).filter((b): b is Band[] => !!b);
  if (!rows.length) return null;
  const n = rows[0].length;
  const sums = new Array<number>(n).fill(0);
  let used = 0;
  for (const b of rows) {
    if (b.length !== n) continue;
    shares(b).forEach((v, i) => (sums[i] += v));
    used++;
  }
  return used ? sums.map((s) => s / used) : null;
}

function Distribution({ bands, avg, label }: { bands: Band[]; avg: number[] | null; label: string }) {
  const sh = shares(bands);
  // scale so the widest bar (or average tick) nearly fills the track
  const peak = Math.max(...sh, ...(avg ?? [0]), 0.01);
  return (
    <table className="tnum w-full text-[12px]" aria-label={label}>
      <tbody>
        {bands.map((b, i) => {
          const a = avg?.[i];
          const above = a != null && sh[i] - a >= 0.02;
          return (
            <tr key={b.label}>
              <th scope="row" className="w-[5.5rem] py-[3px] pr-2 text-left font-normal whitespace-nowrap text-ink-2">
                {b.label}
              </th>
              <td className="py-[3px]">
                <div className="relative h-[9px] rounded-[2px] bg-line/70">
                  <div
                    className={`h-full rounded-[2px] ${above ? "bg-brand-deep" : "bg-brand/55"}`}
                    style={{ width: `${(sh[i] / peak) * 100}%` }}
                  />
                  {a != null && (
                    <span
                      aria-hidden
                      className="absolute -top-[3px] h-[15px] w-[2px] -translate-x-1/2 rounded-full bg-ink"
                      style={{ left: `${(a / peak) * 100}%` }}
                    />
                  )}
                </div>
              </td>
              <td className={`w-10 py-[3px] pl-2 text-right ${above ? "font-semibold text-ink" : "text-ink-2"}`}>
                {pct(sh[i])}
                {a != null && <span className="sr-only">, 17-zip average {pct(a)}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
        {aside && <span className="tnum text-[11.5px] text-ink-3">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-ink-3 italic">{children}</p>;
}

type CompState = { key: string; list: Competitor[] | null; error: string | null };

export default function ZipDetail({
  r,
  type,
  typeLabel,
  ageAvg,
  incomeAvg,
  id,
  insight,
}: {
  insight?: ReactNode;
  r: ZipResult;
  type: BusinessType;
  typeLabel: string;
  ageAvg: number[] | null;
  incomeAvg: number[] | null;
  id: string;
}) {
  const key = `${type}:${r.zip}`;
  const [comp, setComp] = useState<CompState>({ key, list: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchCompetitors(r.zip, type)
      .then((list) => !cancelled && setComp({ key, list, error: null }))
      .catch((e: Error) => !cancelled && setComp({ key, list: null, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [key, r.zip, type]);

  const compList = comp.key === key ? comp.list : null;
  const compError = comp.key === key ? comp.error : null;
  const categories = compList
    ? [...compList.reduce((m, c) => m.set(c.category ?? "Other", (m.get(c.category ?? "Other") ?? 0) + 1), new Map<string, number>())]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  const m = r.male_population;
  const f = r.female_population;
  const sexTotal = m != null && f != null ? m + f : 0;

  return (
    <div id={id} className="border-t border-line bg-bg px-5 pb-5 lg:pl-[3.4rem]" role="region" aria-label={`${r.name} detail`}>
      {insight && <div className="pt-3.5">{insight}</div>}
      {/* Why this score */}
      <p className="tnum pt-3.5 text-[12.5px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">Why {r.total_score.toFixed(1)}:</span> 0.4 × {r.demand_score.toFixed(0)}{" "}
        demand + 0.3 × {r.competition_score.toFixed(0)} low competition + 0.3 × {r.traffic_score.toFixed(0)} foot traffic.
        Demand here = {DEMAND_MEANS[type]}.
      </p>

      <Section
        title="Who lives here"
        aside={
          <>
            {r.population.toLocaleString()} residents
            <span className="mx-1.5 inline-flex items-center gap-1 align-middle">
              <span aria-hidden className="inline-block h-[11px] w-[2px] rounded-full bg-ink" /> 17-zip avg
            </span>
          </>
        }
      >
        {r.age_bands ? (
          <Distribution bands={r.age_bands} avg={ageAvg} label="Age distribution" />
        ) : (
          <Missing>Age breakdown is still loading into the dataset.</Missing>
        )}
        {sexTotal > 0 && (
          <div className="mt-2.5">
            <div className="flex h-[6px] overflow-hidden rounded-full" aria-hidden>
              <div className="bg-brand-deep" style={{ width: `${(f! / sexTotal) * 100}%` }} />
              <div className="bg-brand/35" style={{ width: `${(m! / sexTotal) * 100}%` }} />
            </div>
            <div className="tnum mt-1 flex justify-between text-[11.5px] text-ink-2">
              <span>Female {pct(f! / sexTotal)}</span>
              <span>Male {pct(m! / sexTotal)}</span>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Household income"
        aside={r.median_income != null ? `median $${r.median_income.toLocaleString()}` : undefined}
      >
        {r.income_brackets ? (
          <Distribution bands={r.income_brackets} avg={incomeAvg} label="Household income distribution" />
        ) : (
          <Missing>
            Bracket breakdown is still loading. {Math.round(r.pct_hh_income_75k_plus)}% of households earn $75k+.
          </Missing>
        )}
      </Section>

      <Section title="Neighborhood vibe" aside="AI read of the local business mix">
        {r.vibe ? (
          <p className="insight text-[14px] leading-[1.55] text-ink">{r.vibe}</p>
        ) : (
          <Missing>Not written for this zip yet.</Missing>
        )}
      </Section>

      <Section
        title="Who you'd compete with"
        aside={compList ? `${compList.length} ${typeLabel.toLowerCase()} listings in ${r.zip}` : undefined}
      >
        {compError && <p className="text-[12.5px] text-danger">Couldn&apos;t load competitors: {compError}</p>}
        {!compList && !compError && (
          <div aria-busy="true" className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-3.5 rounded" />
            ))}
          </div>
        )}
        {compList && compList.length === 0 && <Missing>No competitors found in this zip.</Missing>}
        {compList && compList.length > 0 && (
          <>
            <p className="tnum mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-2">
              {categories.map(([c, n]) => (
                <span key={c} className="whitespace-nowrap">
                  {c} <span className="font-semibold text-ink">{n}</span>
                </span>
              ))}
            </p>
            <table className="tnum w-full text-[12.5px]">
              <thead className="sr-only">
                <tr>
                  <th>Name</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {compList.slice(0, 6).map((c, i) => (
                  <tr key={`${c.name}-${i}`}>
                    <td className="max-w-0 py-1.5 pr-2">
                      <span className="block truncate text-ink">{c.name}</span>
                      <span className="block truncate text-[11.5px] text-ink-3">{c.category ?? "—"}</span>
                    </td>
                    <td className="w-12 py-1.5 text-right whitespace-nowrap text-ink-2">
                      {c.rating != null ? `★ ${c.rating.toFixed(1)}` : "—"}
                    </td>
                    <td className="w-20 py-1.5 text-right whitespace-nowrap text-ink-2">
                      {c.review_count != null ? c.review_count.toLocaleString() : "—"}
                      <span className="text-ink-3"> rev.</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Section>
    </div>
  );
}
