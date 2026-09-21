import type { ReactElement } from "react";

/**
 * Hyperlocal business-type icons. Direction: geometric playful, mid-century storefront signage.
 * 24x24 grid, stroke 2, round caps/joins. Primary ink is currentColor; one flat accent fill
 * via --icon-accent (defaults to marigold #D9822B).
 */
const ACCENT = { fill: "var(--icon-accent, #D9822B)" } as const;

const GLYPHS: Record<string, ReactElement> = {
  "coffee shop": (
    <>
      <path d="M3.5 10h13v5.5a5 5 0 0 1-5 5h-3a5 5 0 0 1-5-5z" />
      <path d="M16.5 12h1.25a2.75 2.75 0 0 1 0 5.5H16.5" />
      <path d="M10 8.54 6.93 5.47A1.8 1.8 0 1 1 10 4.2a1.8 1.8 0 1 1 3.07 1.27z" style={ACCENT} stroke="none" />
    </>
  ),
  "food truck": (
    <>
      <path d="M3.5 16H2V6a1 1 0 0 1 1-1h11v11" />
      <path d="M8.5 16h7" />
      <path d="M19.5 16H21v-3.5L17.5 9H14" />
      <circle cx={6} cy={17} r={2} />
      <circle cx={17.5} cy={17} r={2} />
      <path d="M3.5 7h9v1.5a1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0z" style={ACCENT} stroke="none" />
    </>
  ),
  "boutique retail": (
    <>
      <path d="M5 8h14l-1 13H6z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      <path d="M12 14 7.5 11v6zm0 0 4.5-3v6z" style={ACCENT} stroke="none" />
      <circle cx={12} cy={14} r={1.25} fill="currentColor" stroke="none" />
    </>
  ),
  "med spa": (
    <>
      <path d="M7.5 9V5a2.5 2.5 0 0 1 5 0v4z" fill="currentColor" />
      <path d="M6.5 10h7" />
      <path d="M8.5 11v6.5l1.5 2.5 1.5-2.5V11" />
      <path d="M18 2l1.4 3.1 3.1 1.4-3.1 1.4L18 11l-1.4-3.1-3.1-1.4 3.1-1.4zm0 12 .8 1.7 1.7.8-1.7.8L18 19l-.8-1.7-1.7-.8 1.7-.8z" style={ACCENT} stroke="none" />
    </>
  ),
  "tattoo shop": (
    <>
      <path d="M12 18.25 4.75 11A4.25 4.25 0 1 1 12 8a4.25 4.25 0 1 1 7.25 3z" />
      <path d="M1.5 12.5Q12 15 22.5 12.5l-1.5 1.75 1.5 1.75Q12 18.5 1.5 16L3 14.25z" style={ACCENT} stroke="none" />
    </>
  ),
  "laundromat": (
    <>
      <rect x={3.5} y={2.5} width={17} height={19} rx={3} />
      <path d="M3.5 7h17" />
      <circle cx={7} cy={4.75} r={1} fill="currentColor" stroke="none" />
      <path d="M13 4.75h4" />
      <circle cx={12} cy={14} r={5} />
      <path d="M8.84 13.5q1.58-1.2 3.16 0t3.16 0A3.2 3.2 0 1 1 8.84 13.5z" style={ACCENT} stroke="none" />
    </>
  ),
  "car wash": (
    <>
      <path d="M3 17v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4z" />
      <path d="M5 11l3-3h8l3 3" />
      <path d="M6 17v2m12-2v2M10.5 14h3" />
      <circle cx={7.5} cy={14} r={1} fill="currentColor" stroke="none" />
      <circle cx={16.5} cy={14} r={1} fill="currentColor" stroke="none" />
      <path d="M5 6a2.25 2.25 0 1 1 0-4.5A2.25 2.25 0 0 1 5 6zm5.25-2.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zM18.5.75l1.1 1.65 1.65 1.1-1.65 1.1-1.1 1.65-1.1-1.65-1.65-1.1 1.65-1.1z" style={ACCENT} stroke="none" />
    </>
  ),
  "quick lube": (
    <>
      <path d="M3 19v-6a2 2 0 0 1 2-2h7l3 3v5z" />
      <path d="M6 11V9h4v2" />
      <path d="M13.5 12.5 19 7" />
      <path d="M19.5 11l1.6 2.3a2 2 0 1 1-3.2 0z" style={ACCENT} stroke="none" />
    </>
  ),
};

const FALLBACK = <circle cx={12} cy={12} r={8} />;

export function TypeIcon({ type, className }: { type: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[type.trim().toLowerCase()] ?? FALLBACK}
    </svg>
  );
}
