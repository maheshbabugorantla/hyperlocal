import type { ReactNode } from "react";
import type { FactorHelpText } from "../lib/supabase";

/**
 * A factor label with a hover explanation of how its 0–100 score is computed.
 * CSS-only (no state), so it works inside the card's <button> and inside Leaflet popups.
 * `focusable` adds keyboard access where the label isn't already inside another control.
 */
export function FactorHelp({
  label,
  help,
  weight,
  rank,
  total,
  align = "left",
  focusable = false,
  className = "",
}: {
  label: ReactNode;
  help: FactorHelpText;
  weight: number;
  rank?: number;
  total?: number;
  align?: "left" | "right";
  focusable?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`group/help relative inline-flex cursor-help items-center gap-1 outline-none ${className}`}
      tabIndex={focusable ? 0 : undefined}
    >
      <span className="underline decoration-ink-3/50 decoration-dotted underline-offset-[3px]">{label}</span>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-ink-3 group-hover/help:text-brand-deep">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
      </svg>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-[1300] mt-1.5 block w-[248px] rounded-lg bg-ink px-3 py-2.5 text-left text-[11.5px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/help:visible group-hover/help:opacity-100 group-focus-visible/help:visible group-focus-visible/help:opacity-100 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        <span className="block">{help.how}</span>
        <span className="mt-1.5 block font-semibold text-white">This zip: {help.here}</span>
        <span className="mt-1.5 block text-white/70">
          Counts ×{weight} toward the total{rank && total ? ` · #${rank} = ${ordinal(rank)} best of ${total} zips on this factor` : ""}.
        </span>
      </span>
    </span>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
