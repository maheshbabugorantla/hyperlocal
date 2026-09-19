# Hyperlocal: demo video script (target about 3 min)

This is a generic 5-part structure. Remap the sections if the hackathon resource guide's structure differs.
Open https://hyperlocal-sigma.vercel.app in a clean browser window at about 1440×900 before recording.

## 1. Problem (0:00–0:25), whole team on camera
> "If you're opening a coffee shop in Austin, where do you put it? Most small owners go on gut feel, or on
> the area that *feels* busiest. That's often the worst choice, because everyone else had the same idea."

## 2. What we built (0:25–0:50)
> "Hyperlocal scores 17 central Austin zip codes for three kinds of small business: coffee shops, food
> trucks, and boutiques. It weighs local demand, how crowded the competition is, and foot traffic, then
> tells you in plain English why a zip scored well."

Show: the full page, with the map, the ranked list, and the header.

## 3. Live demo (0:50–2:00)
1. **Coffee shop tab:** "The #1 zip for a coffee shop is **78748, Slaughter Lane**, at 82.5. Not downtown."
   Read the insight card out loud: it's generated from the actual numbers.
2. **Click Downtown (78701):** "Downtown scores only 55. It has great demand, but **54 coffee shops**
   already sit inside that zip. Its competition score is near zero."
3. **Switch to Food truck:** "The ranking changes completely. **78703, Clarksville**, is #1 at 77.2:
   only 10 food trucks for a high-traffic, high-income area."
4. **Switch to Boutique retail:** "For boutiques, South Austin (**78745**) and Slaughter Lane lead,
   because almost no direct boutique competition is there yet."
5. Point at the legend and a marker popup: demand, competition, and traffic, weighted 40/30/30.

## 4. How it works (2:00–2:35)
> "Everything on screen is real data. There are no mocks. Census ACS 2020–2024 gives population, age, and
> income for every zip. The Census Gazetteer gives each zip's location. We scraped Google Maps through
> Apify for every zip and business type: 51 scrapes, 1,160 real businesses. A Python pipeline scores
> them into Supabase, Gemini writes the explanations, and the Next.js map on Vercel reads it live."

Show: the README architecture diagram or the GitHub repo for 5 seconds.

## 5. What's next (2:35–3:00)
> "Next: the whole Austin metro rather than 17 zips, per-business weights (food trucks care about
> different things than boutiques), and city permit data as a second source of truth on competition.
> The pipeline takes any zip list, so a new city is a config change plus about $0.30 of scraping per
> zip and type."

## Pre-flight checklist
- [ ] Open the live URL in an incognito window: it loads, all 3 tabs work, and markers appear
- [ ] Close other tabs and notifications, and zoom the browser to 100%
- [ ] Check the numbers in this script against the live page (the data is final, but re-check after any rerun)
