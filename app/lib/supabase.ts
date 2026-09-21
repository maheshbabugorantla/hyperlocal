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
  pop_20_44: number;
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

export const LIVE_CITY = "Austin";

export async function fetchResults(type: BusinessType): Promise<ZipResult[]> {
  const [locations, scores, insights, competitors] = await Promise.all([
    // Suburb zips are in the database but stay hidden until the city switcher ships.
    supabase.from("locations").select("*").eq("city", LIVE_CITY),
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
        pop_20_44: l.pop_20_44,
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
        vibe: (l.vibe as string | null) ?? insightByZip.get(s.zip)?.vibe ?? null,
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

/* ---------------- Score explanations (mirror pipeline/pipeline.py) ---------------- */

const POP_CAP = 20000; // DEMAND_POP_20_44_CAP
const COMPETITION_SATURATION = 60;
const TRAFFIC_REVIEWS_CAP = 20000;

/** Per-type demand profile; null = the original 20–44 + $75k+ signal. */
const DEMAND_PROFILES: Partial<Record<BusinessType, { ages: string[]; agesText: string; incomes: string[] | null; incomesText: string }>> = {
  "med spa": { ages: ["35–44", "45–64"], agesText: "adults 35–64", incomes: ["$100–150k", "$150–200k", "$200k+"], incomesText: "earning $100k+" },
  "tattoo shop": { ages: ["18–24", "25–34"], agesText: "adults 18–34", incomes: null, incomesText: "" },
  laundromat: { ages: ["18–24", "25–34"], agesText: "adults 18–34", incomes: ["<$25k", "$25–50k"], incomesText: "earning under $50k" },
};

const fmt = (n: number) => Math.round(n).toLocaleString();
const pct = (x: number) => `${Math.round(x * 100)}%`;
const sumBands = (bands: Band[] | null, labels: string[]) =>
  (bands ?? []).filter((b) => labels.includes(b.label)).reduce((a, b) => a + b.count, 0);

export type FactorHelpText = { how: string; here: string };

/** Plain-English "how is this computed" plus this zip's own inputs, for one factor. */
export function factorHelp(key: FactorKey, type: BusinessType, r: ZipResult): FactorHelpText {
  if (key === "demand_score") {
    const p = DEMAND_PROFILES[type];
    if (!p) {
      return {
        how: `How many likely customers live here. Half comes from adults aged 20–44 (full marks at ${fmt(POP_CAP)}), half from the share of households earning $75k+. Census ACS 2020–24.`,
        here: `${fmt(r.pop_20_44)} adults 20–44 · ${pct(r.pct_hh_income_75k_plus)} of households earn $75k+`,
      };
    }
    const people = sumBands(r.age_bands, p.ages);
    if (!p.incomes) {
      return {
        how: `How many likely customers live here: ${p.agesText}, any income. Full marks at ${fmt(POP_CAP)} people. Census ACS 2020–24.`,
        here: `${fmt(people)} ${p.agesText} live here`,
      };
    }
    const households = (r.income_brackets ?? []).reduce((a, b) => a + b.count, 0);
    const share = households ? sumBands(r.income_brackets, p.incomes) / households : 0;
    return {
      how: `How many likely customers live here. Half comes from ${p.agesText} (full marks at ${fmt(POP_CAP)}), half from the share of households ${p.incomesText}. Census ACS 2020–24.`,
      here: `${fmt(people)} ${p.agesText} · ${pct(share)} of households ${p.incomesText}`,
    };
  }
  if (key === "competition_score") {
    return {
      how: `Room left in the market. Starts at 100 with no similar businesses inside the zip and drops about ${(100 / COMPETITION_SATURATION).toFixed(1)} points per competitor, reaching 0 at ${COMPETITION_SATURATION}+. Counted from Google Maps.`,
      here: `${r.competitor_count} ${r.competitor_count === 1 ? "competitor" : "competitors"} found in ${r.zip}`,
    };
  }
  // Traffic: invert the log scale to recover the approximate review total behind the score.
  const reviews = Math.pow(10, (r.traffic_score / 100) * Math.log10(1 + TRAFFIC_REVIEWS_CAP)) - 1;
  return {
    how: `How busy the area already is. Adds up the Google reviews of similar businesses here as a foot-traffic proxy, on a log scale: ~100 reviews ≈ 47, ~1,000 ≈ 70, ${fmt(TRAFFIC_REVIEWS_CAP)}+ = 100. No businesses means 0.`,
    here: r.competitor_count === 0 ? "No similar businesses here, so no reviews to count" : `≈ ${fmt(reviews)} reviews across ${r.competitor_count} ${r.competitor_count === 1 ? "place" : "places"}`,
  };
}
