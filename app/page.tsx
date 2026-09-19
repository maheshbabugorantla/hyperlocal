import Dashboard from "./components/Dashboard";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-1 border-b border-line bg-bg px-5 pt-3.5 pb-3">
        <div className="min-w-0">
          <h1 className="text-[20px] leading-tight font-bold tracking-[-0.015em] text-balance text-ink sm:text-[22px]">
            <span className="text-brand">Hyperlocal:</span> best Austin zip codes, by business type
          </h1>
          <p className="mt-0.5 text-[13.5px] text-ink-2">
            17 central Austin zips, scored on who lives there, how many competitors are already open, and
            how busy the streets are.
          </p>
        </div>
        <p className="tnum hidden text-[12px] text-ink-3 md:block">Census ACS 2020–24 · Google Maps</p>
      </header>
      <Dashboard />
    </div>
  );
}
