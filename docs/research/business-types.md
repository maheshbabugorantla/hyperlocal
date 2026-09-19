# Three more business types for Hyperlocal

Research date: 2026-09-19. Counts marked **(measured)** come from Overture Maps Places release `2026-08-19.0` (Austin bbox, `confidence >= 0.5`, joined on the first 5 digits of `postcode`) for the 17 zips in `pipeline.py`. No Apify credit was spent. Google Maps usually finds 1–2× more places than Overture (see `zip-expansion.md`), so read the Overture numbers as ×1–2.

Source tiers: **[T1]** = trade association, IBISWorld, Pew or a law firm. **[T2]** = vendor or trade-press blog. Treat T2 margins as directional only.

## Recommendation (TL;DR)

| Type | Search string | Typical margin | Demand signal (replaces coffee's 20–44 + $75k+) |
|---|---|---|---|
| Med spa | `med spa` | 20–30% net, ~27% EBITDA on a well-run $1.5M location | Women 35–64 (or all adults 35–64), households with **$100k+** income |
| Tattoo studio | `tattoo shop` | 20–35% net; supplies are a small share of the ticket | Adults **20–34**, **no income floor** |
| Laundromat | `laundromat` | 20–35% net, mostly unattended | Adults 20–34, households **under $50k**; renter share if added |

The three have different customers (affluent older women, young adults across incomes, lower-income renters), and none of them is chain-only. Rankings change mostly because of the **demand term** (weight 0.4), since each type drops or flips coffee's $75k+ income signal. Competitor geography also differs: the Spearman rank correlation of per-zip counts against coffee is 0.57 for med spa, 0.66 for tattoo and 0.37 for laundromat **(measured)**.

## Shortlist (10 evaluated)

| Candidate | Margin (source tier) | Startup | Core customer | Overture count, 17 zips (max zip) | Verdict |
|---|---|---|---|---|---|
| **Med spa** | 20–30% net; AmSpa: avg revenue $1.40M (2024), 27.6% EBITDA benchmark [T1/T2] | $250k–$1M+ (lasers, injectables inventory) | Women (88% of patients), 35–64, higher income | 116 (18 in 78704), 1 zip at 0 | **Pick** |
| **Tattoo studio** | 20–35% net; 60–80% gross per piece [T2] | $25k–$80k | 18–34; Pew: 41% of 18–29 and 30–49 year-olds tattooed | 158 (29 in 78702) | **Pick** |
| **Laundromat** | 20–35% net; cash flow $15k–$300k/yr, sells at 3–5× cash flow [T1 CLA] | $200k–$500k new, more for a big build-out | Renters in dense areas, lower income | 56 (11 in 78758), 2 zips at 0 | **Pick** |
| Pilates studio | Industry average ~6–7%; 15–25% well run; 25–35% top decile [T2] | $150k–$300k (reformers $3k–$8k each) | Women 25–44, $100k+ | 82 (13) | Runner-up: the typical margin is low, and the demand signal is almost the same as coffee's |
| Barbershop | 20–30% EBITDA for a multi-chair shop [T2] | $50k–$150k | Men, all incomes | 316 (51 in 78745) | Runner-up: at 2× Google that is ~100 in 78745, so it saturates the 60 cap |
| Pet grooming | IBISWorld margin is paywalled; ~10–20% [T2] | $50k–$150k | Homeowners with dogs, 30–64 | 53 (10), several zeros | Out: sparse, and the results mix in PetSmart and pet-store counters |
| Cocktail / wine bar | 75–85% gross on drinks, 10–20% net [T2 Toast] | $75k–$500k plus a TABC permit | 21–39, higher income | 108 cocktail, 88 of them in 78701/78702 | Out: can't separate the other 15 zips |
| Nail salon | IBISWorld: 8.6% profit (2024) [T1] | $50k–$150k | Women, all incomes | 160 (24) | Out: low margin |
| Bakery / dessert | 5–10% net, 60–80% gross [T2 Toast] | $100k–$400k | Broad, overlaps coffee | 110 (17) | Out: low net margin, and the search results overlap coffee |
| Escape room / IV hydration / phone repair | Escape room 20–40% [T2]; others unknown | varies | Groups / wellness / everyone | 12 / ~8 real / 16 | Out: too few places. IV bars already appear in Overture's `medical_spa` category |

Hair salons (477 places, 56 in 78704) and dry cleaners (47 places, an industry in decline) were also dropped, for saturation and margin reasons.

## Pick 1: Med spa

- **Search string:** `med spa`, which is Google's own "Medical spa" category. Avoid "spa" (that returns day spas and massage) and "aesthetics" (that returns lash and brow bars).
- **Margin evidence:** AmSpa reports average revenue of $1,398,833 in 2024, up from $1,307,587 in 2023, and a 27.6% EBITDA benchmark for a well-run $1.5M single location. Typical net margin is 20–30%.
- **Demand signal:** women aged 35–64 (ACS B01001 has sex by age) and the share of households at **$100k+** (B19001 brackets $100–125k and up). AmSpa: 88% of patients are women, and the 55+ share of female patients rose from 21% to 24% in two years.
- **Density (measured):** 116 places. 78704 has 18, 78703 12, 78705 13, 78745 12, 78757 10, 78758 10. Only 78722 has 0. At 2× that is up to ~36 per zip, safely under the 60 cap.
- **Caveats:**
  - Texas corporate-practice-of-medicine rules mean only a physician can own the medical entity. A non-physician owner uses the common MSO structure plus a physician medical director who does real oversight.
  - The competitor set includes chains (LaserAway, VIO, Mia Aesthetics) and IV-drip bars.
  - Google may also return plastic-surgery and dermatology offices that list "med spa" in their names.

## Pick 2: Tattoo studio

- **Search string:** `tattoo shop`, Google's "Tattoo shop" category. It is tighter than Overture's `tattoo_and_piercing`, which also includes piercing-only studios such as "Studs".
- **Margin evidence:** the tier-2 sources agree on a 20–35% net margin for an established shop, because ink and needles are a small share of a $150–$300/hr ticket. IBISWorld puts the US industry at $1.3B in 2025, growing 10.9% a year since 2020 (its margin figure is paywalled). Startup is low at $25k–$80k, which makes this the easiest pick for an independent owner. Texas requires a DSHS tattoo studio license, which is routine.
- **Demand signal:** population **20–34** with **no income cutoff**. Alternatively, use the share of households under $100k as a mild weight. Pew (2023): 32% of adults have a tattoo, 41% among ages 18–29 and 30–49, 56% among women 18–29, and 13% at 65+.
- **Density (measured):** 158 places, of which 21 in 78702 have "tattoo" in the name. Counts: 78702 29, 78704 27, 78745 16, 78758 16. 78722 has 0.
- **Caveats:**
  - 78702 is the one zip near the cap. Google may return about 40–60 tattoo shops there. The 60-place cap applies to the whole search circle *before* the zip filter, so 78702 may under-count and get too good a competition score. This is the same failure coffee has today.
  - Tattoo is the pick whose competitor geography is closest to coffee's (ρ = 0.66), so it only reranks zips if the income signal really changes.

## Pick 3: Laundromat

- **Search string:** `laundromat`, Google's "Laundromat" category. The sampled names are clean (Washateria, Coin Laundry, Wash and Fold). Wash-and-fold delivery services without a storefront may appear, so filter on `categoryName == "Laundromat"` if needed.
- **Margin evidence:** CLA (the laundry trade association): about 29,500 US stores and ~$5B gross revenue a year. Cash flow is $15k–$300k a year, and stores sell at 3–5× net cash flow. The 20–35% net margin is widely quoted from CLA [T2]. Labor is low because stores are mostly unattended, which is why this is the classic high-margin "boring business".
- **Demand signal:** CLA says stores "perform exceptionally well in predominately renter-occupied, densely populated areas". Best: add ACS **B25003 renter-occupied share**. With what the app has today: population 20–34, and the share of households **under $50k** (B19001 brackets up to $49,999). That is the *inverse* of coffee's income signal, so rankings move the most for this type. Expect 78741, 78752, 78758 and 78723 to rise and 78703 and 78731 to fall.
- **Density (measured):** 56 places. 78758 has 11, 78741 8, 78745 5, 78704 5. 78721 and 78751 have 0. At 2× that is at most ~22 per zip, so there is no saturation and the zips separate cleanly.
- **Caveats:**
  - Startup cost is the highest of the three, and many owners buy an existing store instead of building one.
  - Review counts are low for laundromats, so the log(reviews) traffic proxy is compressed. Percentile scoring helps here.
  - Apartments with in-unit laundry (common in new builds in 78701 and 78758) reduce demand in ways the Census signal doesn't capture.

## Runners-up

1. **Pilates studio** (`pilates studio`): clean string, good spread (82 places). But the typical margin is ~6–7% and its demand signal duplicates coffee's.
2. **Barbershop** (`barber shop`): a distinct male, all-income audience with ρ = 0.38 against coffee. But it saturates the 60 cap in 78745, 78757 and 78702 unless the pipeline switches to area-wide or Overture counts.
3. **Pet grooming** (`dog groomer`): good suburban and family fit, but sparse and mixed with big-box pet stores.

## Sources

- AmSpa Medical Spa State of the Industry: https://www.americanmedspa.org/med-spa-statistics/. Revenue and EBITDA figures are via https://spaledger.co/blog/med-spa-profit-margin and https://www.vagaro.com/learn/med-spa-profit-margins-guide [T2].
- Texas CPOM / MSO: https://www.hchlawyers.com/blog/2026/february/mso-for-med-spas-how-non-physicians-can-own-oper/, https://pabau.com/blog/who-can-own-a-med-spa-in-texas/
- CLA industry overview: https://laundryassociation.org/for-investors/industry-overview/. Margin: https://www.supermoney.com/how-much-does-it-cost-to-open-a-laundromat [T2]
- IBISWorld tattoo artists (US): https://www.ibisworld.com/united-states/industry/tattoo-artists/4404/. Pew tattoos 2023: https://www.pewresearch.org/short-reads/2023/08/15/32-of-americans-have-a-tattoo-including-22-who-have-more-than-one/. Shop economics: https://www.menubly.com/blog/how-much-does-it-cost-to-open-a-tattoo-shop/ [T2]
- IBISWorld nail salons, 8.6% profit: https://img.ibisworld.com/united-states/industry/personal-waxing-nail-salons/4411
- Pilates: https://thepilatesbusiness.com/the-profitability-paradox-pilates-studios-in-2026/, https://www.marianatek.com/blog/how-to-open-a-pilates-studio/ [T2]
- Barbershop: https://bookedin.com/blog/are-barbershops-profitable-what-to-know/ [T2]. Bars: https://pos.toasttab.com/blog/on-the-line/bar-profit-margin [T2]. Bakery: https://pos.toasttab.com/blog/on-the-line/how-much-do-bakeries-make [T2]. Escape rooms: https://erworkshop.com/home/is-it-profitable-to-be-an-escape-room-owner/ [T2]
- IBISWorld pet grooming and boarding: https://www.ibisworld.com/united-states/industry/pet-grooming-boarding/1735/
- Overture Places: https://docs.overturemaps.org/guides/places/, `s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*`
