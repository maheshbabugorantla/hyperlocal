# Expanding Hyperlocal beyond 17 hardcoded Austin zips

Research date: 2026-09-19. Numbers marked **(measured)** come from files downloaded and queried for this doc. The scratch scripts are not in the repo.

## Recommendation (TL;DR)

1. **Pick zips automatically:** CBSA delineation (county list) → Census 2020 ZCTA–county relationship file → keep ZCTAs with more than 50% of their land in the CBSA → drop ZCTAs with population under 1k. Austin–Round Rock–San Marcos: **88 ZCTAs (82 with pop ≥ 1k)**. No API key needed.
2. **Name zips:** the Census place with the largest land overlap (for example "Round Rock", "Georgetown"). Where many ZCTAs fall in one big city (41 in Austin), add a neighborhood name by spatial join to city open-data neighborhood polygons. Keep the current `ZIP_NAMES` as manual overrides.
3. **Split the two jobs Apify does today:**
   - **Competitor counts** come from **Overture Maps Places**: free, one DuckDB query per metro (5 s for Austin), r = 0.75–0.97 against the Apify counts **(measured)**. The levels differ, though: Overture has 2–10× fewer food trucks in outer zips and more "retail". Use it for *ranking*, which means it has to ship together with the percentile scoring in item 4.
   - **Review counts** (the traffic proxy) are the only thing nothing free provides. Keep Apify only for those, as **one area-wide search per business type per metro** instead of a 60-place circle per zip. Apify now bills per place, so area-wide costs about $15–20 per metro, compared with $20–79 for per-zip circles (unverified: see §3).
4. **Scoring:** switch fixed caps to percentile ranks within the selected metro. Normalize competition per km² and per 10k residents. Drop the 1.5–5 km circle clamp, which misrepresents 43 of the 88 metro ZCTAs.
5. **Frontend:** a metro selector, choropleth ZCTA polygons from Census cartographic boundaries, and a pre-simplified static GeoJSON per metro (Austin: 45 KB gzipped).
6. **Budget:** about $10 of the $30 Apify cap remains. Phase (a) fits only with Overture counts ($0) plus Apify reviews on a shortlist, or after the monthly cap resets.

---

## 1. Choosing zip sets automatically

### Sources

| Source | What it gives | URL | Notes |
|---|---|---|---|
| CBSA delineation (Jul 2023, the latest) | CBSA → county FIPS | https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx | No 2024 or 2025 file exists yet (404). Austin = CBSA `12420`, DFW = `19100`, Houston = `26420`. |
| 2020 ZCTA ↔ county relationship file | One row per ZCTA × county piece, with `AREALAND_PART` | https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt | Pipe-delimited, 6.8 MB, UTF-8 BOM. Docs: https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html |
| 2020 ZCTA ↔ place relationship file | ZCTA × city/CDP pieces with names | https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt | Use for "city" scope and for names. |
| HUD–USPS ZIP crosswalk (API) | Real USPS ZIP → county/CBSA/tract, with `res_ratio`/`bus_ratio` and USPS preferred city | https://www.huduser.gov/portal/datasets/usps_crosswalk.html, API base `https://www.huduser.gov/hudapi/public/usps` | Needs a free bearer token. Updated quarterly. Includes PO-box ZIPs. |

### Join logic (what the pipeline should do)

```
counties = delineation[CBSA Code == "12420"] -> state FIPS + county FIPS  (5 counties)
for each ZCTA in the zcta_county file:
    share = sum(AREALAND_PART where county in counties) / sum(AREALAND_PART)
keep ZCTA if share > 0.5          # "any overlap" pulls in fringe rural ZCTAs
drop ZCTA if ACS B01001_001E < 1000   # empty, institutional, or park ZCTAs
```

For a city instead of a metro, use the place file with `GEOID_PLACE_20 = 4805000` (Austin city) and keep ZCTAs that have 50% or more of their land in the place.

### Counts (measured)

| Area | ZCTAs, any overlap | ZCTAs, >50% of land | Pop ≥ 1k | Pop ≥ 5k | Area > 78.5 km² (5 km clamp) |
|---|---|---|---|---|---|
| Austin CBSA (5 counties) | 100 | **88** | 82 | 71 | 35 |
| Austin city (place 4805000) | 53 | 32 | – | – | – |
| Dallas–Fort Worth CBSA (11 counties) | 292 | **273** | 258 | 239 | 81 |
| Houston CBSA (10 counties) | 256 | **242** | 218 | 205 | 70 |
| San Antonio CBSA | 131 | 121 | 104 | 86 | 48 |

### ZIP vs ZCTA

- ZCTAs are built from 2020 census blocks. They are not USPS ZIPs. PO-box-only and single-firm ZIPs usually have no ZCTA (https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html). The national Gazetteer has 33,791 ZCTAs, compared with about 41k USPS ZIPs.
- This is fine for Hyperlocal: ACS demand only exists at the ZCTA level, so **ZCTA is the unit**. A PO-box ZIP has no residents to score anyway.
- Pitfall: Google and Overture `postalCode` values are USPS ZIPs. A place whose ZIP has no ZCTA (for example a downtown PO-box ZIP) is dropped by the current `postalCode.startswith(zip)` filter. At scale, assign places to ZCTAs by **point-in-polygon** against the ZCTA boundaries instead. In Austin, Overture's postcode matched the containing ZCTA only **91%** of the time (measured).
- HUD's crosswalk is only needed if users type real USPS ZIPs. In that case, map ZIP → ZCTA with the ZIP's `res_ratio`.

## 2. Naming zips without hand labels

| Option | Free? | Coverage | Quality for this app |
|---|---|---|---|
| Census place with the largest land overlap (place file above) | Yes, no key | National | Good in suburbs: gives Round Rock, Georgetown, Buda. Useless inside a big city: 41 of 88 Austin ZCTAs are just "Austin city". Rural ZCTAs can pick a tiny CDP ("Rosanky CDP"). |
| HUD `USPS_ZIP_PREF_CITY` | Yes, token | National | Same limitation: the postal city, often "AUSTIN" for 40+ zips. |
| City open-data neighborhood polygons, e.g. Austin `Neighborhoods` (103 polygons, field `neighname`) https://data.austintexas.gov/Locations-and-Maps/Neighborhoods/a7ap-j2yt; also Neighborhood Planning Areas `inrm-c3ee` (95) | Yes | Per city; schemas differ | Best labels. Take the neighborhood that covers most of the ZCTA, or the top 2 joined with " / ". This is the same style as the current hand labels. |
| Overture Divisions `neighborhood`/`macrohood` polygons https://docs.overturemaps.org/guides/divisions/ | Yes (ODbL) | National, "sub-county coverage is spotty" | Good generic fallback for any city with no portal. Same DuckDB workflow as Places. |
| Who's On First neighbourhoods https://whosonfirst.org/download/ | Yes (mostly CC-BY) | National, uneven | Fine fallback, but more awkward to consume than Overture. |
| Zillow neighborhoods | No longer published | – | Skip. |

**Recommended labels:** `"{neighborhood} · {city}"` if a neighborhood polygon covers ≥ 40% of the ZCTA. Otherwise `"{place name} {zip}"`. Hand overrides stay in a small `zip_overrides` table.

## 3. Scaling competitor data

### Apify pricing (measured from the actor API, pricing effective 2026-06-30)

`GET https://api.apify.com/v2/acts/compass~crawler-google-places` → `pricingInfos` (pay per event, FREE-tier prices):

- place scraped **$0.004** (BRONZE $0.003, SILVER $0.002, GOLD $0.0015)
- filter applied **$0.001 per place**
- actor start $0.00005
- `reviewsCount` and `totalScore` come on the search card, with no details add-on (https://apify.com/compass/crawler-google-places).

60 × ($0.004 + $0.001) = **$0.30**, which is exactly the measured cost per run. So:
- **Cost is per place, not per run.** A circle that returns 60 places, 50 of them in *other* zips, still bills all 60.
- `skipClosedPlaces` appears to be what triggers the filter-applied event (~20% of cost). Filter `permanentlyClosed`/`temporarilyClosed` client-side instead. Verify on one run's charged events.
- The actor can search a whole area (`locationQuery`, `county`, or a `customGeolocation` Polygon/MultiPolygon) and splits it internally, with no `maxCrawledPlacesPerSearch` cap. **Unverified:** that overlapping tiles bill each place only once. The area-wide estimate depends on it. Check with one area-wide run over a single county (about $1–2): compare the run's `chargedEventCounts` with the number of distinct place IDs in the dataset.

### Cost estimates for 3 business types

Place volumes come from Overture counts inside the metro's ZCTAs (measured: Austin coffee 910, boutique/clothing/gift 1,272, food truck 392). Google usually finds 1–2× more.

| Scope | Per-zip circles (today: 60/run × $0.005) | Area-wide search per type ($0.004/place, 1.5–2× Overture) | Wall time |
|---|---|---|---|
| Austin CBSA, 88 ZCTAs (71 new) | 264 runs: **$20–79**. $79 is the ceiling if every circle fills to 60. The central runs did fill (even 78731, with 7 in-zip), and in-zip-only volume is about $12–20. ~45 min at 3 parallel | ≈ **$15–20** | Per-zip: 264 × 30 s / 3. Area-wide: 3 runs, a few minutes to tens of minutes each (unmeasured) |
| Houston CBSA, 242 ZCTAs | 726 runs ≈ **$218**, ~2 h | ≈ $45–65 (scaled by population, 3.1×) | |
| DFW CBSA, 273 ZCTAs | 819 runs ≈ **$246**, ~2.3 h | ≈ $50–70 (3.3×) | |
| Dallas city only, 47 ZCTAs | 141 runs ≈ $42 | ≈ $15–20 | |

Per-zip circles also *undercount*: 11 of the 50 logged runs had ≥ 46 in-zip competitors, and three had 59 (78702 coffee and trucks, 78704 coffee). Those runs hit the 60 cap.

### Alternatives

| Source | Cost | Counts | Categories | Rating | Review count | Notes |
|---|---|---|---|---|---|---|
| **Overture Maps Places** (https://docs.overturemaps.org/guides/places/) | Free (CDLA-Permissive-2.0 / Apache-2.0) | Yes | Yes (`coffee_shop`, `food_truck`, `boutique`, `womens_clothing_store`…) plus `confidence` | No | No | Aug 2026 release has about 74M places. Austin bbox → 141k places in **5 s** via DuckDB on `s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*`. Per-zip correlation with the Apify counts **(measured, 17 zips)**: coffee r = 0.89, retail r = 0.97, food truck r = 0.75 (Overture misses many trucks). 97.5% of places have a postcode. The correlations used a postcode join that matches the containing ZCTA only 91% of the time, so they are a floor. |
| **Foursquare OS Places** (https://docs.foursquare.com/data-products/docs/access-fsq-os-places) | Free (Apache-2.0), portal signup, Iceberg catalog or HF | Yes | Yes (FSQ taxonomy) plus `date_closed` | No | No | Good second opinion for counts, especially closed places. |
| **OSM via Overpass** (https://wiki.openstreetmap.org/wiki/Overpass_API) | Free (ODbL) | Yes | `amenity=cafe`, `shop=clothes/boutique`; food trucks are poorly tagged | No | No | Public instance: under 10k queries/day, no parallel scripts. Sparser than Overture for US retail. |
| **Google Places API (New)** (https://developers.google.com/maps/billing-and-pricing/pricing) | Text/Nearby Search **Enterprise** (needed for `rating`/`userRatingCount`): $35 per 1k requests, 1,000 free per month per SKU | Yes (≤ 20 per request; paginate) | Yes (`primaryType`) | Yes | Yes | **Blocker:** only the place ID is exempt from caching limits. Results shown on a map must be on a *Google Map* (https://developers.google.com/maps/documentation/places/web-service/policies). Storing review counts in Supabase and drawing on Leaflet conflicts with the terms. |
| **Austin Food Establishment Inspection Scores** `ecmv-9xxi` (https://data.austintexas.gov/resource/ecmv-9xxi.json) | Free, Socrata API | Yes: 6,477 facilities with `zip_code` and lat/lng, current to 2026-08-25 | Name only (183 facility names contain "COFFEE") | Inspection score only | No | Authoritative evidence that a place exists, for Austin only. Needs name or Overture matching to categorize. |
| Austin "Mobile Food Vendors" `gebe-5qkn` | – | **No**: 32 ordinance-area polygons, last updated 2020 | – | – | – | **Not a vendor list.** The README's "mobile vendor permits" next step does not exist in usable form. |

**Traffic proxy without Google:** Census LEHD LODES workplace-area jobs per block (aggregated to ZCTA) is a free daytime-population signal (https://lehd.ces.census.gov/data/). Total Overture POI density per km² is another. Either can replace or blend with log(review count) when Apify is out of budget.

## 4. Scoring changes at scale

| Problem today | Evidence | Change |
|---|---|---|
| Competition saturates at 60, which equals the scrape cap | 3 runs at 59; dense zips all score about 0 | With Overture or area-wide counts there is no cap. Score **competitors per 10k residents** (demand pressure) blended with **competitors per km²** (street density). Percentile-rank both within the metro. |
| Fixed caps (`DEMAND_POP_20_44_CAP=20000`, `TRAFFIC_REVIEWS_CAP=20000`) were tuned for central Austin | Suburban ZCTAs cluster near the bottom; DFW or Houston dense cores saturate | **Percentile rank within the selected metro** for each component, stored next to the raw values. Keep the fixed-cap score as an "absolute" column so cross-metro comparison is still possible. |
| Raw pop 20–44 favors large ZCTAs | Metro ZCTAs range from under 7 km² (8 of them) to hundreds of km² | Use **density of 20–44 year-olds per km²** (ALAND is already in the Gazetteer) plus the income share. |
| 1.5–5 km circle clamp | **35 of 88** Austin ZCTAs are larger than 78.5 km², so the circle misses most of the zip. **8** are under 7 km², so the circle spills into neighbors. | Stop using circles. Assign places to ZCTAs by point-in-polygon. For Apify reviews, search the ZCTA polygon or the metro polygon. |
| Traffic = log(total reviews) grows with zip size | Big zips accumulate reviews | Use reviews per competitor (average venue busyness), or reviews per km². |

Keep `rescore` working: store raw inputs (counts, area, reviews) and compute percentiles in one pass per metro. That pass is cheap and deterministic.

## 5. Frontend changes

| Topic | Recommendation |
|---|---|
| Region model | Add a `region` column (CBSA code) to `locations` and `scores`. Add a `regions` table (id, name, center, zoom, bbox, status). Query with `.eq("region", ...)`. Today `fetchResults` loads **all** locations and competitors; at 250+ zips, send the competitor count from a view or column instead of fetching competitor rows. |
| Selectors | Add a metro dropdown next to the type selector, and put the region in the URL (`?metro=12420&type=coffee+shop`). The top-5 list, color scale and insights then work per region. The LLM prompt must stop hardcoding "Austin" and "17 central Austin zips". |
| Polygons vs circles | Use a choropleth of ZCTA polygons, with circles only as the zoomed-out fallback. Circles overlap badly across 88+ zips of very different sizes. |
| Boundary source | `cb_2020_us_zcta520_500k.zip` (https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip, 66 MB, national only). Use it only at build or pipeline time: clip per metro, simplify, and write one GeoJSON per region to `public/` or Supabase Storage. |
| Size per metro (measured, 5-decimal coordinates) | Austin (88): 359 KB raw / **94 KB gzipped**; at tolerance 0.001° 175/**45 KB**; at 0.003° 93/**23 KB**. DFW (273): 910/236, 422/**109**, 215/53 KB. Houston (242): 794/208, 363/94, 190/46 KB. The 0.001° setting (about 100 m) looks right at metro zoom. |
| Loading | Fetch the region's GeoJSON and scores lazily on selection. Join them client-side on `ZCTA5CE20` = `zip`. No tiles or PostGIS are needed below about 300 zips per region. |

## 6. Phased plan

| Phase | Scope | Work | Effort | Recurring cost |
|---|---|---|---|---|
| **(a) Austin metro** | 88 ZCTAs (82 with pop ≥ 1k) × 3 types | `select_zctas(cbsa)` from the relationship files. Overture loader plus point-in-polygon for counts. Auto names (place plus Austin neighborhoods, with `ZIP_NAMES` as overrides). Percentile and density scoring. Choropleth. Region column. | **2–3 days** | Overture and Census $0. Apify reviews: area-wide 3 runs ≈ $15–20 (fits after the cap resets), **or** within the ~$10 left: in-zip reviews for the top about 25 zips per type from Overture scoring, with no `skipClosedPlaces`. Gemini: 15 insights. |
| **(b) Other Texas metros** | DFW 273, Houston 242, San Antonio 121 ZCTAs | Make the pipeline take `--cbsa`. Add a metro selector and region GeoJSON. Generic neighborhood names from Overture Divisions where there is no city portal. Scoring unchanged, because percentiles are per metro. | **1–2 days** | Apify area-wide ≈ $45–70 per big metro, ≈ $150–200 for all three. That needs an Apify plan above the $30 cap, or Overture-only traffic (LODES) for these metros. |
| **(c) Any US metro on demand** | User picks a CBSA; the pipeline runs lazily | `regions.status` = `pending/running/ready`. A queue (Supabase row plus a cron or worker, since Vercel functions are too short for the pipeline). Census and Overture stage in minutes. Apify reviews run as a background job with a per-month spend guard. Cache per region, refresh monthly. | **3–5 days** | $0 per metro with Overture plus LODES. About $10–70 per metro when reviews are enabled, depending on size. Gate it behind auth or a daily quota. |

**Order inside phase (a):** relationship-file selection → Overture counts → rescore with percentiles → choropleth. At that point the app works metro-wide at $0. Apify reviews are an additive refinement, not a prerequisite.

## Sources

- Census ZCTAs: https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html
- Census 2020 relationship files: https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html
- CBSA delineation files: https://www.census.gov/geographies/reference-files/time-series/demo/metro-micro/delineation-files.html
- Cartographic boundary files: https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html
- HUD–USPS crosswalk: https://www.huduser.gov/portal/datasets/usps_crosswalk.html and https://www.huduser.gov/portal/dataset/uspszip-api.html
- Apify Google Maps Scraper: https://apify.com/compass/crawler-google-places and its pricing at https://apify.com/compass/crawler-google-places/pricing
- Overture Places and Divisions: https://docs.overturemaps.org/guides/places/, https://docs.overturemaps.org/guides/divisions/
- Foursquare OS Places: https://docs.foursquare.com/data-products/docs/access-fsq-os-places
- Overpass API usage policy: https://wiki.openstreetmap.org/wiki/Overpass_API
- Google Places pricing and policies: https://developers.google.com/maps/billing-and-pricing/pricing, https://developers.google.com/maps/documentation/places/web-service/policies
- Austin open data: https://data.austintexas.gov/Locations-and-Maps/Neighborhoods/a7ap-j2yt, https://data.austintexas.gov/resource/ecmv-9xxi.json, https://data.austintexas.gov/Locations-and-Maps/Mobile-Food-Vendors/gebe-5qkn
- LEHD LODES: https://lehd.ces.census.gov/data/
