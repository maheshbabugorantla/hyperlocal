import Dashboard from "./components/Dashboard";
import { HyperlocalMark } from "./components/HyperlocalMark";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-line bg-bg px-5 pt-3 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <HyperlocalMark className="h-9 w-9 shrink-0 text-brand-deep" />
          <h1 className="text-[22px] leading-tight font-bold tracking-[-0.015em] text-brand-deep">Hyperlocal</h1>
        </div>
        <div className="text-[12px] leading-snug text-ink-3 md:text-right">
          <p>
            <span className="font-semibold text-ink-2">Now mapping:</span> Austin, TX · 17 zip codes · 6 business types
          </p>
          <p className="tnum">Census ACS 2020–24 · Google Maps · Gemini</p>
        </div>
      </header>
      <Dashboard />
    </div>
  );
}
