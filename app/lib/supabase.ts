import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export const BUSINESS_TYPES = [
  { value: "coffee shop", label: "Coffee shop" },
  { value: "food truck", label: "Food truck / pop-up" },
  { value: "boutique retail", label: "Boutique retail" },
  { value: "med spa", label: "Med spa" },
  { value: "tattoo shop", label: "Tattoo studio" },
  { value: "laundromat", label: "Laundromat" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

/** What the demand sub-score measures for each type (mirrors the pipeline). */
export const DEMAND_MEANS: Record<BusinessType, string> = {
  "coffee shop": "adults 20–44 + households earning $75k+",
  "food truck": "adults 20–44 + households earning $75k+",
  "boutique retail": "adults 20–44 + households earning $75k+",
  "med spa": "adults 35–64 + households earning $100k+",
  "tattoo shop": "adults 18–34, any income",
  laundromat: "adults 18–34 + households earning under $50k",
};

export type ZipResult = {
  zip: string;
  name: string;
  lat: number;
  lng: number;
  population: number;
  median_income: number | null;
  pct_hh_income_75k_plus: number;
  demand_score: number;
  competition_score: number;
  traffic_score: number;
  total_score: number;
  competitor_count: number;
  insight: string | null;
  /** 6 ACS B01001 age bands, Under 18 … 65+. Null until the pipeline fills it. */
  age_bands: Band[] | null;
  /** 7 ACS B19001 household income brackets, <$25k … $200k+. */
  income_brackets: Band[] | null;
  male_population: number | null;
  female_population: number | null;
  /** AI read of the zip's scraped business mix. */
  vibe: string | null;
};

export type Band = { label: string; count: number };

export type Competitor = {
  name: string;
  category: string | null;
  rating: number | null;
  review_count: number | null;
};

function bands(v: unknown): Band[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out = v
    .filter((b): b is Band => b && typeof b.label === "string" && Number.isFinite(Number(b.count)))
    .map((b) => ({ label: b.label, count: Number(b.count) }));
  return out.length ? out : null;
}

export async function fetchResults(type: BusinessType): Promise<ZipResult[]> {
  const [locations, scores, insights, competitors] = await Promise.all([
    supabase.from("locations").select("*"),
    supabase.from("scores").select("*").eq("business_type", type),
    // "*" rather than "zip,summary,vibe" so a missing vibe column degrades instead of failing the page
    supabase.from("insights").select("*").eq("business_type", type),
    supabase.from("competitors").select("zip").eq("search_type", type),
  ]);
  const error = locations.error ?? scores.error ?? insights.error ?? competitors.error;
  if (error) throw new Error(error.message);

  const locByZip = new Map(locations.data!.map((l) => [l.zip, l]));
  const insightByZip = new Map(
    insights.data!.map((i) => [i.zip, { summary: i.summary as string, vibe: (i.vibe as string | null) ?? null }]),
  );
  const compCount = new Map<string, number>();
  for (const c of competitors.data!) compCount.set(c.zip, (compCount.get(c.zip) ?? 0) + 1);

  return scores
    .data!.filter((s) => locByZip.has(s.zip))
    .map((s) => {
      const l = locByZip.get(s.zip)!;
      return {
        zip: s.zip,
        name: l.name,
        lat: l.lat,
        lng: l.lng,
        population: l.population,
        median_income: l.median_income,
        pct_hh_income_75k_plus: Number(l.pct_hh_income_75k_plus),
        demand_score: Number(s.demand_score),
        competition_score: Number(s.competition_score),
        traffic_score: Number(s.traffic_score),
        total_score: Number(s.total_score),
        competitor_count: compCount.get(s.zip) ?? 0,
        insight: insightByZip.get(s.zip)?.summary ?? null,
        age_bands: bands(l.age_bands),
        income_brackets: bands(l.income_brackets),
        male_population: l.male_population ?? null,
        female_population: l.female_population ?? null,
        vibe: insightByZip.get(s.zip)?.vibe ?? null,
      };
    })
    .sort((a, b) => b.total_score - a.total_score);
}

/** All scraped competitors of one type in one zip, most-reviewed first (a zip is well under 1,000 rows). */
export async function fetchCompetitors(zip: string, type: BusinessType): Promise<Competitor[]> {
  const { data, error } = await supabase
    .from("competitors")
    .select("name,category,rating,review_count")
    .eq("zip", zip)
    .eq("search_type", type)
    .order("review_count", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    name: c.name,
    category: c.category ?? null,
    rating: c.rating == null ? null : Number(c.rating),
    review_count: c.review_count == null ? null : Number(c.review_count),
  }));
}

/** 0..1 position of a score within the current result set, for color/size. */
export function scoreRange(results: ZipResult[]) {
  const totals = results.map((r) => r.total_score);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  return { min, max, t: (score: number) => (max > min ? (score - min) / (max - min) : 1) };
}

/**
 * Sequential single-hue ramp (mineral teal, hue ~200): pale = weaker, deep = stronger.
 * Lightness carries the signal so it survives color-vision deficiency.
 */
export function scoreColor(t: number) {
  const c = Math.min(1, Math.max(0, t));
  const l = 0.78 - c * 0.42;
  const ch = 0.05 + c * 0.06;
  const h = 196 + c * 8;
  return `oklch(${l.toFixed(3)} ${ch.toFixed(3)} ${h.toFixed(1)})`;
}

export const FACTORS = [
  { key: "demand_score", label: "Demand", weight: 0.4 },
  { key: "competition_score", label: "Low competition", weight: 0.3 },
  { key: "traffic_score", label: "Foot traffic", weight: 0.3 },
] as const;

export type FactorKey = (typeof FACTORS)[number]["key"];

/** Rank (1 = best) of each zip on each factor within the current result set. */
export function factorRanks(results: ZipResult[]) {
  const ranks = new Map<string, Record<FactorKey, number>>();
  for (const r of results) ranks.set(r.zip, { demand_score: 0, competition_score: 0, traffic_score: 0 });
  for (const f of FACTORS) {
    const sorted = [...results].sort((a, b) => b[f.key] - a[f.key]);
    sorted.forEach((r, i) => {
      // ties share the better rank
      const prev = sorted[i - 1];
      const rank = prev && prev[f.key] === r[f.key] ? ranks.get(prev.zip)![f.key] : i + 1;
      ranks.get(r.zip)![f.key] = rank;
    });
  }
  return ranks;
}
