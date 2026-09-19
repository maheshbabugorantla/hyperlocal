import Dashboard from "./components/Dashboard";
import { HyperlocalMark } from "./components/HyperlocalMark";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-line bg-bg px-5 pt-3 pb-3">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <HyperlocalMark className="mt-0.5 h-10 w-10 shrink-0 text-brand-deep sm:mt-0" />
          <div className="min-w-0">
            <h1 className="text-[20px] leading-tight font-bold tracking-[-0.015em] text-balance text-ink sm:text-[22px]">
              <span className="text-brand-deep">Hyperlocal</span>
              <span className="text-ink-3"> · </span>
              find the block where your business belongs
            </h1>
            <p className="mt-0.5 text-[13.5px] text-ink-2">
              Every neighborhood scored on who lives there, who you&apos;d compete with, and how busy the streets
              already are, so you pick a location on evidence, not gut feel.
            </p>
          </div>
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
