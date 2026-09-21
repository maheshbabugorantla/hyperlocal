"""Hyperlocal data pipeline.

Usage:
  python pipeline.py check                               # Ticket 0: env + connectivity
  python pipeline.py run --zip 78702 --type "coffee shop" # Ticket 1: one combination
  python pipeline.py run --all                           # Ticket 2: 17 zips x 3 types + insights
  python pipeline.py insights                            # regenerate insights only
  python pipeline.py enrich                              # age/income shape + vibes (no scraping)
  python pipeline.py rescore                             # recompute scores from stored data
  python pipeline.py schema                              # create tables (needs SUPABASE_DB_URL)
"""

import argparse
import csv
import io
import math
import os
import sys
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT.parent / ".env")
load_dotenv(ROOT / ".env")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AUSTIN_ZIPS = [
    "78701", "78702", "78703", "78704", "78705", "78721", "78722", "78723", "78731",
    "78741", "78745", "78748", "78751", "78752", "78756", "78757", "78758",
]
# Residential ZCTAs only; PO-box zips (78630, 78680, 78682, 78683, 78691) have no Census data.
SUBURB_ZIPS = {
    "78613": "Cedar Park",
    "78664": "Round Rock",
    "78665": "Round Rock",
    "78681": "Round Rock",
    "78660": "Pflugerville",
    "78634": "Hutto",
    "78642": "Liberty Hill",
    "76574": "Taylor",
}
ZIPS = AUSTIN_ZIPS + list(SUBURB_ZIPS)
ZIP_CITY = {**{z: "Austin" for z in AUSTIN_ZIPS}, **SUBURB_ZIPS}


def region_of(city):
    """Zips are ranked (for insight wording) against their own region."""
    return "central Austin" if city == "Austin" else "Austin-area suburbs"

BUSINESS_TYPES = [
    "coffee shop", "food truck", "boutique retail", "med spa", "tattoo shop", "laundromat", "car wash", "quick lube",
]
# Google Maps search string when it differs from the business type.
SEARCH_STRINGS = {"quick lube": "oil change"}
# Keep only these Google categories. Broad searches pull in gas stations, detailers and
# general repair shops (probed 2026-09-20: 17 of 51 "car wash" hits in 78613 were car washes).
CATEGORY_ALLOW = {
    "car wash": {"Car wash"},
    "quick lube": {"Oil change service"},
}

# Display labels only: ZCTAs have no official names.
ZIP_NAMES = {
    "78701": "Downtown",
    "78702": "East Austin",
    "78703": "Clarksville / Tarrytown",
    "78704": "South Congress / Bouldin",
    "78705": "West Campus / UT",
    "78721": "MLK / Johnston Terrace",
    "78722": "Cherrywood / French Place",
    "78723": "Windsor Park / Mueller",
    "78731": "Northwest Hills",
    "78741": "East Riverside",
    "78745": "South Austin / Garrison Park",
    "78748": "Slaughter Lane / Shady Hollow",
    "78751": "Hyde Park",
    "78752": "St. John / Highland",
    "78756": "Brentwood",
    "78757": "Crestview / Allandale",
    "78758": "North Burnet / The Domain",
    "78613": "Cedar Park",
    "78664": "Old Town Round Rock",
    "78665": "Northeast Round Rock / Teravista",
    "78681": "West Round Rock / Brushy Creek",
    "78660": "Pflugerville",
    "78634": "Hutto",
    "78642": "Liberty Hill",
    "76574": "Taylor",
}

# Score weights (same for every business type for now).
W_DEMAND = 0.4
W_COMPETITION = 0.3
W_TRAFFIC = 0.3

# Who each business type sells to. Types not listed use the original demand signal
# (population 20-44 + share of households earning $75k+). Labels match AGE_BANDS /
# INCOME_BRACKETS; income None means demand is population-only.
DEMAND_PROFILES = {
    "med spa": {
        "ages": ["35–44", "45–64"],
        "incomes": ["$100–150k", "$150–200k", "$200k+"],
        "describe": "adults 35-64 and households earning $100k+",
    },
    "tattoo shop": {
        "ages": ["18–24", "25–34"],
        "incomes": None,
        "describe": "adults 18-34, any income",
    },
    "laundromat": {
        "ages": ["18–24", "25–34"],
        "incomes": ["<$25k", "$25–50k"],
        "describe": "adults 18-34 and households earning under $50k",
    },
}
DEFAULT_DEMAND_DESCRIPTION = "adults 20-44 and households earning $75k+"
# Car-service demand follows cars, not age or income (ACS B08201 vehicles, B08301 commute mode).
VEHICLE_TYPES = {"car wash", "quick lube"}
VEHICLE_DEMAND_DESCRIPTION = "vehicles kept by households here, and the share of workers who drive alone"
VEHICLE_CAP = 50000

# Fixed reference scales so every row scores 0-100 on its own.
DEMAND_POP_20_44_CAP = 20000     # 20-44 population at which demand's population half maxes out
COMPETITION_SATURATION = 60      # in-zip competitors at which competition score hits 0 (= APIFY_MAX_PLACES)
TRAFFIC_REVIEWS_CAP = 20000      # total nearby reviews at which traffic score maxes out

ACS_YEAR = 2024                  # ACS 5-year 2020-2024, current release
APIFY_ACTOR = "compass~crawler-google-places"
APIFY_MAX_PLACES = 60
MAX_SEARCH_RADIUS_KM = 12        # large rural suburb zips (Taylor ~11 km, Liberty Hill ~10 km)
APIFY_MEMORY_MB = 4096           # x PARALLEL_COMBOS must stay under the account's 16 GB limit
APIFY_RUN_TIMEOUT_S = 600
APIFY_START_RETRIES = 20
PARALLEL_COMBOS = 3
TOP_N_INSIGHTS = 5              # ranks framed as "top" / "bottom" in insight prompts
GEMINI_PARALLEL = 8
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")

REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "CENSUS_API_KEY", "APIFY_TOKEN", "GEMINI_API_KEY"]
CACHE = ROOT / ".cache"


# Newer Supabase projects name keys "secret"/"publishable" instead of "service"/"anon".
ENV_ALIASES = {"SUPABASE_SERVICE_KEY": "SUPABASE_SECRET_KEY"}


def env(name):
    value = os.environ.get(name) or os.environ.get(ENV_ALIASES.get(name, ""))
    if not value:
        sys.exit(f"Missing env var {name} (set it in .env at the repo root)")
    return value


def supabase():
    from supabase import create_client
    return create_client(env("SUPABASE_URL"), env("SUPABASE_SERVICE_KEY"))


def gemini():
    from google import genai
    return genai.Client(api_key=env("GEMINI_API_KEY"))


# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------

def gazetteer_path():
    """Download the newest Census ZCTA Gazetteer file available (cached)."""
    CACHE.mkdir(exist_ok=True)
    for year in range(date.today().year, date.today().year - 5, -1):
        path = CACHE / f"{year}_Gaz_zcta_national.zip"
        if path.exists():
            return path
        url = f"https://www2.census.gov/geo/docs/maps-data/data/gazetteer/{year}_Gazetteer/{year}_Gaz_zcta_national.zip"
        resp = requests.get(url, timeout=120)
        if resp.status_code == 200:
            path.write_bytes(resp.content)
            print(f"  downloaded {year} Gazetteer")
            return path
    raise RuntimeError("No Census ZCTA Gazetteer file found for the last 5 years")


_coords = None


def zip_coords(zip_code):
    global _coords
    if _coords is None:
        with zipfile.ZipFile(gazetteer_path()) as zf:
            text = zf.read(zf.namelist()[0]).decode("utf-8")
        delimiter = "|" if "|" in text.splitlines()[0] else "\t"
        rows = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        _coords = {
            r["GEOID"].strip(): (
                float(r["INTPTLAT"]),
                float(r[next(k for k in r if k.strip() == "INTPTLONG")]),
                float(r["ALAND"]),
            )
            for r in rows
        }
    lat, lng, _ = _coords[zip_code]
    return lat, lng


def zip_radius_km(zip_code):
    """Radius of a circle with the zip's land area, clamped to a sane search range."""
    zip_coords(zip_code)
    land_m2 = _coords[zip_code][2]
    return round(min(max(math.sqrt(land_m2 / math.pi) / 1000, 1.5), MAX_SEARCH_RADIUS_KM), 2)


def acs(get, zip_code):
    resp = requests.get(
        f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5",
        params={"get": get, "for": f"zip code tabulation area:{zip_code}", "key": env("CENSUS_API_KEY")},
        timeout=60,
    )
    resp.raise_for_status()
    header, values = resp.json()
    return dict(zip(header, values))


# ACS variable ranges per band; female B01001 codes are male codes + 24.
AGE_BANDS = [
    ("Under 18", range(3, 7)),
    ("18–24", range(7, 11)),
    ("25–34", range(11, 13)),
    ("35–44", range(13, 15)),
    ("45–64", range(15, 20)),
    ("65+", range(20, 26)),
]
INCOME_BRACKETS = [
    ("<$25k", range(2, 6)),
    ("$25–50k", range(6, 11)),
    ("$50–75k", range(11, 13)),
    ("$75–100k", range(13, 14)),
    ("$100–150k", range(14, 16)),
    ("$150–200k", range(16, 17)),
    ("$200k+", range(17, 18)),
]


def acs_count(table, var):
    value = int(float(table[var]))
    return value if value >= 0 else 0  # Census uses large negatives for "not available"


def vehicle_profile(zip_code):
    """Total household vehicles (4+ counted as 4) and drive-alone share of commuters."""
    v = acs("group(B08201)", zip_code)
    c = acs("B08301_001E,B08301_003E", zip_code)
    workers = acs_count(c, "B08301_001E")
    return {
        "vehicles": sum(k * acs_count(v, f"B08201_{k + 2:03d}E") for k in range(1, 5)),
        "drove_alone_share": round(acs_count(c, "B08301_003E") / workers, 4) if workers else 0,
    }


def demographic_shape(age, income):
    return {
        "age_bands": [
            {"label": label, "count": sum(acs_count(age, f"B01001_{i:03d}E") + acs_count(age, f"B01001_{i + 24:03d}E") for i in r)}
            for label, r in AGE_BANDS
        ],
        "income_brackets": [
            {"label": label, "count": sum(acs_count(income, f"B19001_{i:03d}E") for i in r)}
            for label, r in INCOME_BRACKETS
        ],
    }


def demographics(zip_code):
    age = acs("group(B01001)", zip_code)
    income = acs("group(B19001)", zip_code)
    median = acs("B19013_001E", zip_code)

    n = acs_count

    male_20_44 = sum(n(age, f"B01001_{i:03d}E") for i in range(8, 15))
    female_20_44 = sum(n(age, f"B01001_{i:03d}E") for i in range(32, 39))
    households = n(income, "B19001_001E")
    hh_75k_plus = sum(n(income, f"B19001_{i:03d}E") for i in range(13, 18))
    median_income = int(float(median["B19013_001E"]))
    lat, lng = zip_coords(zip_code)
    return {
        "zip": zip_code,
        "name": ZIP_NAMES.get(zip_code, zip_code),
        "city": ZIP_CITY.get(zip_code, "Austin"),
        "lat": lat,
        "lng": lng,
        "population": n(age, "B01001_001E"),
        "male_population": n(age, "B01001_002E"),
        "female_population": n(age, "B01001_026E"),
        "pop_20_44": male_20_44 + female_20_44,
        "median_income": median_income if median_income > 0 else None,
        "pct_hh_income_75k_plus": round(hh_75k_plus / households, 4) if households else 0,
        **demographic_shape(age, income),
        **vehicle_profile(zip_code),
    }


def apify_run(actor_input):
    """Start an async Apify run, wait for it, return its dataset items.

    Async (not run-sync) so a dropped HTTP connection can't orphan a run that keeps
    holding account memory. Retries while the account's memory limit is full.
    """
    api = "https://api.apify.com/v2"
    token = {"token": env("APIFY_TOKEN")}
    for attempt in range(APIFY_START_RETRIES):
        resp = requests.post(
            f"{api}/acts/{APIFY_ACTOR}/runs",
            params={**token, "memory": APIFY_MEMORY_MB, "timeout": APIFY_RUN_TIMEOUT_S},
            json=actor_input,
            timeout=60,
        )
        if resp.status_code != 402:
            break
        time.sleep(15)  # memory limit full: wait for another run to finish
    resp.raise_for_status()
    run = resp.json()["data"]
    try:
        while run["status"] in ("READY", "RUNNING"):
            run = requests.get(
                f"{api}/actor-runs/{run['id']}", params={**token, "waitForFinish": 60}, timeout=90
            ).json()["data"]
    except BaseException:
        requests.post(f"{api}/actor-runs/{run['id']}/abort", params=token, timeout=30)
        raise
    if run["status"] != "SUCCEEDED":
        raise RuntimeError(f"Apify run {run['id']} ended {run['status']}")
    items = requests.get(
        f"{api}/datasets/{run['defaultDatasetId']}/items", params={**token, "clean": 1}, timeout=120
    )
    items.raise_for_status()
    return items.json()


def scrape_competitors(zip_code, business_type):
    """Google Maps places for business_type located in zip_code, via Apify.

    Searches a circle around the zip's Census internal point (Apify's locationQuery
    geocodes bare zip codes unreliably), then keeps places whose postal code matches.
    """
    lat, lng = zip_coords(zip_code)
    places = apify_run({
        "searchStringsArray": [SEARCH_STRINGS.get(business_type, business_type)],
        "customGeolocation": {"type": "Point", "coordinates": [lng, lat], "radiusKm": zip_radius_km(zip_code)},
        "maxCrawledPlacesPerSearch": APIFY_MAX_PLACES,
        "language": "en",
        "skipClosedPlaces": True,
    })
    in_zip = [p for p in places if str(p.get("postalCode") or "").startswith(zip_code)]
    allowed = CATEGORY_ALLOW.get(business_type)
    if allowed:
        in_zip = [p for p in in_zip if p.get("categoryName") in allowed]
    return [
        {
            "zip": zip_code,
            "search_type": business_type,
            "name": p.get("title"),
            "category": p.get("categoryName"),
            "rating": p.get("totalScore"),
            "review_count": p.get("reviewsCount") or 0,
        }
        for p in in_zip
    ]


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def demand_score(loc, business_type):
    if business_type in VEHICLE_TYPES:
        return 100 * (
            0.5 * min((loc.get("vehicles") or 0) / VEHICLE_CAP, 1)
            + 0.5 * float(loc.get("drove_alone_share") or 0)
        )
    profile = DEMAND_PROFILES.get(business_type)
    if profile is None:
        return 100 * (
            0.5 * min(loc["pop_20_44"] / DEMAND_POP_20_44_CAP, 1)
            + 0.5 * float(loc["pct_hh_income_75k_plus"])
        )
    ages = {b["label"]: b["count"] for b in loc["age_bands"]}
    target_pop = sum(ages[label] for label in profile["ages"])
    pop_part = min(target_pop / DEMAND_POP_20_44_CAP, 1)
    if profile["incomes"] is None:
        return 100 * pop_part
    incomes = {b["label"]: b["count"] for b in loc["income_brackets"]}
    households = sum(incomes.values())
    income_share = sum(incomes[label] for label in profile["incomes"]) / households if households else 0
    return 100 * (0.5 * pop_part + 0.5 * income_share)


def compute_scores(loc, competitors, business_type):
    demand = demand_score(loc, business_type)
    competition = 100 * (1 - min(len(competitors) / COMPETITION_SATURATION, 1))
    total_reviews = sum(c["review_count"] for c in competitors)
    traffic = 100 * min(math.log10(1 + total_reviews) / math.log10(1 + TRAFFIC_REVIEWS_CAP), 1)
    total = W_DEMAND * demand + W_COMPETITION * competition + W_TRAFFIC * traffic
    return {
        "demand_score": round(demand, 1),
        "competition_score": round(competition, 1),
        "traffic_score": round(traffic, 1),
        "total_score": round(total, 1),
    }


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def ensure_location(db, zip_code):
    existing = db.table("locations").select("*").eq("zip", zip_code).execute().data
    if existing:
        return existing[0]
    loc = demographics(zip_code)
    db.table("locations").upsert(loc).execute()
    return loc


def process(zip_code, business_type, db=None):
    """Fetch, score and store one zip + business type. Idempotent."""
    db = db or supabase()
    loc = ensure_location(db, zip_code)
    competitors = scrape_competitors(zip_code, business_type)
    scores = compute_scores(loc, competitors, business_type)

    db.table("competitors").delete().eq("zip", zip_code).eq("search_type", business_type).execute()
    if competitors:
        db.table("competitors").insert(competitors).execute()
    db.table("scores").delete().eq("zip", zip_code).eq("business_type", business_type).execute()
    db.table("scores").insert({"zip": zip_code, "business_type": business_type, **scores}).execute()
    print(f"  OK {zip_code} {business_type}: {len(competitors)} competitors, total {scores['total_score']}")
    return scores


def insight_prompt(loc, business_type, score, competitors, rank, total, region):
    comp_lines = "\n".join(
        f"- {c['name']} ({c['category']}), rating {c['rating']}, {c['review_count']} reviews"
        for c in competitors[:15]
    ) or "- none found in this zip"
    if rank <= TOP_N_INSIGHTS:
        ask = f"explain why this zip scored well for a {business_type}. Lead with the single biggest reason"
    elif rank > total - TOP_N_INSIGHTS:
        ask = (f"explain honestly why this zip ranks near the bottom for a {business_type}. Lead with the biggest "
               "drag on the score, then mention any genuine bright spot")
    else:
        ask = (f"explain why this zip lands mid-pack for a {business_type}: name its main strength and the "
               "main thing holding it back")
    return f"""You are advising someone opening a {business_type} in {loc.get('city') or 'Austin'}, TX.
Zip {loc['zip']} ({loc['name']}) ranks #{rank} of {total} {region} zips for a {business_type}.

Scores (0-100): total {score['total_score']}, demand {score['demand_score']},
competition {score['competition_score']} (higher = fewer competitors), foot traffic proxy {score['traffic_score']}.
Weights: demand {W_DEMAND}, competition {W_COMPETITION}, traffic {W_TRAFFIC}.
Demand for a {business_type} is measured as: {VEHICLE_DEMAND_DESCRIPTION if business_type in VEHICLE_TYPES else DEMAND_PROFILES.get(business_type, {}).get("describe", DEFAULT_DEMAND_DESCRIPTION)}.
Vehicles kept by households: {loc.get('vehicles')}; share of workers who drive alone: {float(loc.get('drove_alone_share') or 0):.0%}.

Demographics (Census ACS 5-year): population {loc['population']}, ages 20-44 {loc['pop_20_44']},
median household income ${loc['median_income']}, {float(loc['pct_hh_income_75k_plus']):.0%} of households earn $75k+.
Age bands (people): {', '.join(f"{b['label']} {b['count']}" for b in loc.get('age_bands') or [])}.
Household income brackets (households): {', '.join(f"{b['label']} {b['count']}" for b in loc.get('income_brackets') or [])}.

Existing {business_type} competitors located in this zip ({len(competitors)} total):
{comp_lines}

In 2-3 short plain-English sentences (under 60 words total), {ask}. Cite one or two specific
numbers and don't restate the score itself. Use ONLY the facts above: no assumptions about housing,
amenities, landmarks, or anything else not listed. No preamble, no bullet points."""


def rescore(db=None):
    """Recompute every score from stored locations + competitors (no scraping)."""
    db = db or supabase()
    locs = {l["zip"]: l for l in db.table("locations").select("*").execute().data}
    for row in db.table("scores").select("id,zip,business_type").execute().data:
        competitors = (
            db.table("competitors").select("review_count").eq("zip", row["zip"])
            .eq("search_type", row["business_type"]).execute().data
        )
        scores = compute_scores(locs[row["zip"]], competitors, row["business_type"])
        db.table("scores").update(scores).eq("id", row["id"]).execute()
    print_summary(db)


def generate_insights(db=None, types=None, zips=None):
    """A written insight for every zip x business type, framed by the zip's rank within its region.

    With `zips`, only those zips' insights are (re)written; everything else is left untouched.
    """
    db = db or supabase()
    client = gemini()
    locs = {l["zip"]: l for l in db.table("locations").select("*").execute().data}

    def write(business_type, score, rank, total, region):
        competitors = (
            db.table("competitors").select("*").eq("zip", score["zip"])
            .eq("search_type", business_type).order("review_count", desc=True).execute().data
        )
        prompt = insight_prompt(locs[score["zip"]], business_type, score, competitors, rank, total, region)
        return client.models.generate_content(model=GEMINI_MODEL, contents=prompt).text.strip()

    for business_type in types or BUSINESS_TYPES:
        all_scores = (
            db.table("scores").select("*").eq("business_type", business_type)
            .order("total_score", desc=True).execute().data
        )
        by_region = {}
        for score in all_scores:
            region = region_of(locs[score["zip"]].get("city") or ZIP_CITY.get(score["zip"], "Austin"))
            by_region.setdefault(region, []).append(score)
        jobs = [
            (score, rank, len(ranked), region)
            for region, ranked in by_region.items()
            for rank, score in enumerate(ranked, start=1)
            if not zips or score["zip"] in zips
        ]
        rows = []
        with ThreadPoolExecutor(max_workers=GEMINI_PARALLEL) as pool:
            futures = {pool.submit(write, business_type, *job): job[0]["zip"] for job in jobs}
            for fut in as_completed(futures):
                try:
                    rows.append({"zip": futures[fut], "business_type": business_type, "summary": fut.result()})
                except Exception as exc:  # noqa: BLE001 - log and keep going
                    print(f"  FAILED insight {business_type} {futures[fut]}: {exc}")
        # Swap the affected zips of this type at once so the site never shows a half-empty set.
        if rows:
            query = db.table("insights").delete().eq("business_type", business_type)
            if zips:
                query = query.in_("zip", [r["zip"] for r in rows])
            query.execute()
            db.table("insights").insert(rows).execute()
        print(f"  insights {business_type}: {len(rows)}/{len(jobs)}")


def vibe_prompt(loc, businesses):
    lines = "\n".join(
        f"- {b['name']} ({b['category']}), rating {b['rating']}, {b['review_count']} reviews"
        for b in businesses
    )
    return f"""Below are the most-reviewed local businesses we found on Google Maps inside zip
{loc['zip']} ({loc['name']}, {loc.get('city') or 'Austin'}, TX), across coffee shops, food trucks, boutiques, med spas, tattoo studios and
laundromats. Using ONLY this list (no outside knowledge about the neighborhood, no landmarks, no history),
describe the neighborhood's commercial vibe in 2 short sentences, under 45 words: what kind of places
dominate, and what that suggests about who goes there. If the list is short, say the area is thin on
these businesses. No preamble.

{lines or '- (no businesses found)'}"""


def generate_vibes(db=None, zips=None):
    """One grounded 'vibe' line per zip, stored on locations.vibe."""
    db = db or supabase()
    client = gemini()
    locs = [l for l in db.table("locations").select("*").execute().data if not zips or l["zip"] in zips]

    def write(loc):
        businesses = (
            db.table("competitors").select("name,category,rating,review_count").eq("zip", loc["zip"])
            .order("review_count", desc=True).limit(50).execute().data
        )
        text = client.models.generate_content(model=GEMINI_MODEL, contents=vibe_prompt(loc, businesses)).text.strip()
        db.table("locations").update({"vibe": text}).eq("zip", loc["zip"]).execute()
        return text

    with ThreadPoolExecutor(max_workers=GEMINI_PARALLEL) as pool:
        futures = {pool.submit(write, loc): loc["zip"] for loc in locs}
        for fut in as_completed(futures):
            try:
                print(f"  vibe {futures[fut]}: {fut.result()[:80]}...")
            except Exception as exc:  # noqa: BLE001
                print(f"  FAILED vibe {futures[fut]}: {exc}")


def enrich(db=None):
    """Backfill demographic shape for every stored zip, then vibes. Census + Gemini only, no scraping."""
    db = db or supabase()
    for row in db.table("locations").select("zip").execute().data:
        z = row["zip"]
        try:
            shape = {**demographic_shape(acs("group(B01001)", z), acs("group(B19001)", z)), **vehicle_profile(z)}
            db.table("locations").update(shape).eq("zip", z).execute()
            print(f"  shape {z}: {[b['count'] for b in shape['age_bands']]}")
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED shape {z}: {exc}")
    generate_vibes(db)


def print_summary(db):
    rows = db.table("scores").select("*").order("business_type").order("total_score", desc=True).execute().data
    names = {r["zip"]: r["name"] for r in db.table("locations").select("zip,name").execute().data}
    print(f"\n{'business_type':<16} {'zip':<6} {'name':<30} {'total':>6}")
    for r in rows:
        print(f"{r['business_type']:<16} {r['zip']:<6} {names.get(r['zip'], ''):<30} {r['total_score']:>6}")


def run_all(types=None, zips=None):
    db = supabase()
    zips = zips or ZIPS
    # Demographics once per zip, sequentially, before the parallel scrapes.
    for z in zips:
        try:
            ensure_location(db, z)
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED location {z}: {exc}")
    combos = [(z, t) for t in (types or BUSINESS_TYPES) for z in zips]
    failures = []
    with ThreadPoolExecutor(max_workers=PARALLEL_COMBOS) as pool:
        futures = {pool.submit(process, z, t): (z, t) for z, t in combos}
        for fut in as_completed(futures):
            try:
                fut.result()
            except Exception as exc:  # noqa: BLE001
                failures.append(futures[fut])
                print(f"  FAILED {futures[fut]}: {exc}")
    print(f"\n{len(combos) - len(failures)}/{len(combos)} combinations succeeded")
    if failures:
        print("Failed:", failures)
    generate_insights(db, types, zips)
    generate_vibes(db, zips)
    print_summary(db)


# ---------------------------------------------------------------------------
# Ticket 0: connectivity check
# ---------------------------------------------------------------------------

def check():
    missing = [k for k in REQUIRED_ENV if not (os.environ.get(k) or os.environ.get(ENV_ALIASES.get(k, "")))]
    for k in REQUIRED_ENV:
        print(f"  {'OK     ' if k not in missing else 'MISSING'} {k}")

    def step(label, fn):
        try:
            print(f"OK   {label}: {fn()}")
            return True
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL {label}: {exc}")
            return False

    def check_supabase():
        db = supabase()
        counts = {}
        for t in ["locations", "competitors", "scores", "insights"]:
            counts[t] = db.table(t).select("*", count="exact").limit(0).execute().count
        return counts

    def check_apify():
        r = requests.get("https://api.apify.com/v2/users/me", params={"token": env("APIFY_TOKEN")}, timeout=30)
        r.raise_for_status()
        return f"user {r.json()['data']['username']}"

    def check_gemini():
        client = gemini()
        available = [m.name.removeprefix("models/") for m in client.models.list()]
        if GEMINI_MODEL not in available:
            flash = [m for m in available if "flash" in m]
            raise RuntimeError(f"model {GEMINI_MODEL!r} not available; flash models: {flash}")
        return client.models.generate_content(model=GEMINI_MODEL, contents="say OK").text.strip()

    checks = [
        ("SUPABASE_SERVICE_KEY", "Supabase (row counts)", check_supabase),
        ("CENSUS_API_KEY", "Census B19013_001E 78702", lambda: acs("B19013_001E", "78702")["B19013_001E"]),
        (None, "Census Gazetteer 78702", lambda: zip_coords("78702")),
        ("APIFY_TOKEN", "Apify", check_apify),
        ("GEMINI_API_KEY", f"Gemini {GEMINI_MODEL}", check_gemini),
    ]
    results = [step(label, fn) if key not in missing else print(f"SKIP {label}") for key, label, fn in checks]
    sys.exit(0 if all(results) and not missing else 1)


def apply_schema():
    """Run schema.sql directly against Postgres (the REST API can't do DDL)."""
    import psycopg
    conninfo = env("SUPABASE_DB_URL")  # Supabase -> Connect -> Connection string (URI)
    with psycopg.connect(conninfo, autocommit=True) as conn:
        existing = conn.execute(
            "select table_name from information_schema.tables where table_schema = 'public'"
        ).fetchall()
        if {"locations", "competitors", "scores", "insights"} <= {r[0] for r in existing}:
            print("Tables already exist, nothing to do")
            return
        conn.execute((ROOT / "schema.sql").read_text())
        conn.execute("notify pgrst, 'reload schema'")
    print("Schema applied")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    run = sub.add_parser("run")
    run.add_argument("--zip")
    run.add_argument("--type", choices=BUSINESS_TYPES)
    run.add_argument("--all", action="store_true")
    run.add_argument("--types", nargs="+", choices=BUSINESS_TYPES, help="with --all: only these types")
    run.add_argument("--zips", nargs="+", choices=ZIPS, help="with --all: only these zips")
    sub.add_parser("insights")
    sub.add_parser("summary")
    sub.add_parser("schema")
    sub.add_parser("rescore")
    sub.add_parser("enrich")
    args = parser.parse_args()

    if args.cmd == "check":
        check()
    elif args.cmd == "insights":
        generate_insights()
        generate_vibes()
    elif args.cmd == "enrich":
        enrich()
    elif args.cmd == "rescore":
        rescore()
    elif args.cmd == "schema":
        apply_schema()
    elif args.cmd == "summary":
        print_summary(supabase())
    elif args.all:
        run_all(args.types, args.zips)
    elif args.zip and args.type:
        process(args.zip, args.type)
    else:
        parser.error("run needs --all or both --zip and --type")


if __name__ == "__main__":
    main()
