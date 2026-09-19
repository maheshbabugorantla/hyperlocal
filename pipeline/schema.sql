create table locations (
  zip text primary key,
  name text,
  lat double precision,
  lng double precision,
  population integer,
  male_population integer,
  female_population integer,
  pop_20_44 integer,
  median_income integer,
  pct_hh_income_75k_plus numeric
);

create table competitors (
  id bigint generated always as identity primary key,
  zip text references locations(zip),
  search_type text,        -- 'coffee shop' | 'food truck' | 'boutique retail', which scrape found it
  name text,
  category text,           -- Google's own category label, informational only
  rating numeric,
  review_count integer
);

create table scores (
  id bigint generated always as identity primary key,
  zip text references locations(zip),
  business_type text,      -- 'coffee shop' | 'food truck' | 'boutique retail'
  demand_score numeric,
  competition_score numeric,
  traffic_score numeric,
  total_score numeric,
  computed_at timestamptz default now()
);

create table insights (
  id bigint generated always as identity primary key,
  zip text references locations(zip),
  business_type text,
  summary text
);

alter table locations enable row level security;
alter table competitors enable row level security;
alter table scores enable row level security;
alter table insights enable row level security;

create policy "public read" on locations for select using (true);
create policy "public read" on competitors for select using (true);
create policy "public read" on scores for select using (true);
create policy "public read" on insights for select using (true);
