# Hyperlocal

**Best Austin zip codes to open a coffee shop, food truck / pop-up, or boutique retail store.**

- Live app: https://hyperlocal-sigma.vercel.app
- Repo: https://github.com/maheshbabugorantla/hyperlocal

Hyperlocal scores 17 central Austin zip codes for each business type on three factors: local demand (Census demographics), competition (existing businesses from Google Maps), and a foot-traffic proxy (review volume). It shows them on a map with a ranked top 5 and a plain-English AI explanation for each.

## Quick start

```bash
# 0. Supabase: paste pipeline/schema.sql into the SQL Editor and run it once
#    (or set SUPABASE_DB_URL in .env and run `pipeline.py schema`).
# 1. Secrets
cp .env.example .env          # fill in pipeline keys
cp .env.example .env.local    # fill in NEXT_PUBLIC_* keys

# 2. Pipeline (Python 3.10+)
uv venv --python 3.12 pipeline/.venv
VIRTUAL_ENV=pipeline/.venv uv pip install -r pipeline/requirements.txt
pipeline/.venv/bin/python pipeline/pipeline.py check                                # connectivity
pipeline/.venv/bin/python pipeline/pipeline.py run --zip 78702 --type "coffee shop"  # one combo
pipeline/.venv/bin/python pipeline/pipeline.py run --all                            # 51 combos + insights

# 3. App
npm install
npm run dev                   # http://localhost:3000

# 4. Deploy
npx vercel --prod             # set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in the Vercel project
```

Other commands: `pipeline.py rescore` recomputes scores from stored data after tuning a constant (no scraping). `pipeline.py insights` regenerates only the AI text. `pipeline.py summary` prints the score table.

## Tech stack & architecture

- **Pipeline:** Python (`requests`, `supabase`, `google-genai`)
- **Database:** Supabase Postgres. RLS allows public read-only access; only the pipeline's service key can write.
- **Frontend:** Next.js 16 (App Router), Tailwind 4, react-leaflet, deployed on Vercel.
- **LLM:** Google Gemini Flash writes the "why this zip scored well" text.

```
 Census Gazetteer ─┐
 Census ACS 5-yr ──┤                         ┌── locations   (demographics, 1 row / zip)
 Apify Google Maps ┼─► pipeline/pipeline.py ─┼── competitors (per zip × business type)
 Gemini Flash ─────┘   (score + explain)     ├── scores      (per zip × business type)
                                             └── insights    (top 5 per business type)
                                                    │  Supabase (RLS: public read)
                                                    ▼
                                  Next.js on Vercel (anon key, read-only)
                                  map + type selector + ranked sidebar
```

### Scoring

Each zip × business type gets a score from 0 to 100. The weights are named constants at the top of `pipeline/pipeline.py`:

| Component | Weight | Formula |
|---|---|---|
| Demand | 40% | 50% × min(pop aged 20–44 / 20,000, 1) + 50% × share of households earning $75k+ |
| Competition | 30% | 1 − min(# same-type businesses in the zip / 60, 1): fewer competitors scores higher |
| Foot traffic | 30% | log10(1 + total Google reviews of those businesses) / log10(1 + 20,000), capped at 1 |

The scales are fixed rather than relative to the other zips, so each score stands on its own and rerunning the pipeline is stable. The map's colors and sizes are relative to the currently selected type, so the spread is easy to see.

## How to reproduce

The env vars are listed in [`.env.example`](.env.example):

| Variable | Used by | Where to get it |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | pipeline | Supabase → Project Settings → API |
| `CENSUS_API_KEY` | pipeline | https://api.census.gov/data/key_signup.html (free) |
| `APIFY_TOKEN` | pipeline | Apify console → Settings → Integrations |
| `GEMINI_API_KEY`, `GEMINI_MODEL` (optional) | pipeline | Google AI Studio |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend | Supabase → Project Settings → API |

The pipeline is idempotent: rerunning it replaces each zip × type's rows instead of duplicating them. If one combination fails, the error is logged and the run continues.

## Datasets & provenance

All data is real. None of it is synthetic or mocked.

- **Census ACS 5-year estimates, 2020–2024** (`api.census.gov/data/2024/acs/acs5`), at ZCTA level:
  - `B01001` sex by age: total, male, and female population, and population aged 20–44
  - `B19001` household income brackets: share of households earning $75k+
  - `B19013` median household income
- **Census ZCTA Gazetteer** (latest year available, auto-downloaded): the internal-point lat/lng for each zip.
- **Google Maps via the Apify Google Maps Scraper** (`compass/crawler-google-places`): up to 60 places per search for each business type within a circle around each zip (sized from its Census land area), filtered to places whose postal code matches the zip. Fields: name, category, rating, review count.
- **Neighborhood names** (e.g. 78702 → "East Austin") are hand-written display labels. ZCTAs have no official names.

## Known limitations & next steps

- It covers 17 central zips, not all of Austin.
- Foot traffic is a proxy based on review counts, not real mobility data (e.g. SafeGraph/Placer.ai).
- A zip with no same-type competitors gets a foot-traffic score of 0, because the proxy is built from those competitors' reviews (e.g. 78722 for boutique retail). A demand-side traffic source would fix this.
- Competition counts come from the top 60 Google Maps results per search, so very dense zips may be undercounted.
- The weights are the same for every business type. Tuning them per type is the obvious next step (for example, food trucks care less about rent-driven income signals).
- Next data source: Overture Maps Places (free, categorized) as a second competition count, with Apify kept only for review counts. Austin's "Mobile Food Vendors" open dataset is 2020 zone polygons, not a vendor list, so it can't serve as a competitor source; the Food Establishment Inspection dataset can, but it only has names, no categories.
- Expanding beyond 17 zips (metro-wide zip selection, naming, cost, scoring changes): see [`docs/research/zip-expansion.md`](docs/research/zip-expansion.md).
