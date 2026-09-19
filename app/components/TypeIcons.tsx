import type { BusinessType } from "../lib/supabase";

/*
 * Hand-drawn business-type icons on a 24-unit grid, 1.6 stroke.
 * Primary strokes use currentColor so they read on light and dark-teal tabs;
 * one warm accent (--icon-accent) picks out the whimsical detail.
 * `.ti-steam` / `.ti-bubbles` / `.ti-sparkle` / `.ti-lights` drift on hover (see globals.css).
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

const ACCENT = "var(--icon-accent)";

function Coffee({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <g className="ti-steam">
        <path d="M9 2.8c-.9 1 .9 1.8 0 3" />
        <path d="M12.4 2.3c-.9 1 .9 1.8 0 3" />
      </g>
      <path d="M4.5 8.5h11v5.3a4.7 4.7 0 0 1-4.7 4.7H9.2a4.7 4.7 0 0 1-4.7-4.7z" />
      <path d="M15.5 10h1.3a2.3 2.3 0 0 1 0 4.6h-1.6" />
      <path d="M3.5 21h14" />
      <path
        d="M10 15.6 8.5 14.2a1 1 0 1 1 1.5-1.3 1 1 0 1 1 1.5 1.3z"
        fill={ACCENT}
        stroke={ACCENT}
        strokeWidth={0.9}
      />
    </svg>
  );
}

function FoodTruck({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.8 4.6c3.6 1.6 7.4 1.6 11 0" strokeWidth={1.1} />
      <g className="ti-lights" fill={ACCENT} stroke="none">
        <circle cx="5.3" cy="5.7" r="0.95" />
        <circle cx="8.3" cy="6.2" r="0.95" />
        <circle cx="11.3" cy="5.7" r="0.95" />
      </g>
      <path d="M2.5 9.5h11.5v8H2.5z" />
      <path d="M14 11.5h3.6l2.9 3v3h-6.5" />
      <path d="M2 9.5 3 7.8h10.5l1 1.7" />
      <path d="M2.5 9.5c.7 1 1.7 1 2.4 0 .7 1 1.7 1 2.4 0 .7 1 1.7 1 2.4 0 .7 1 1.7 1 2.4 0 .7 1 1.7 1 2.4 0" strokeWidth={1.2} />
      <path d="M5 13.8h6" />
      <circle cx="6" cy="18.2" r="1.8" />
      <circle cx="16.8" cy="18.2" r="1.8" />
    </svg>
  );
}

function Boutique({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5.2 8.5h13.6l-1 11.3a1.4 1.4 0 0 1-1.4 1.2H7.6a1.4 1.4 0 0 1-1.4-1.2z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
      <g fill={ACCENT} stroke={ACCENT} strokeWidth={0.9}>
        <path d="M12 12.4c-1.3-1.5-3.3-1.3-3 .1.3 1.3 2 .8 3-.1z" />
        <path d="M12 12.4c1.3-1.5 3.3-1.3 3 .1-.3 1.3-2 .8-3-.1z" />
        <path d="m11.6 12.8-1 2.6M12.4 12.8l1 2.6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function MedSpa({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10.2 9.5V5.2a1.6 1.6 0 0 1 3.2 0v4.3" />
      <path d="M9 9.5h5.6v2H9z" />
      <path d="M8.3 11.5h7v8.2a1.6 1.6 0 0 1-1.6 1.6h-3.8a1.6 1.6 0 0 1-1.6-1.6z" />
      <path d="M8.3 15.5c1.2.7 2.3-.6 3.5 0s2.3.7 3.5 0" strokeWidth={1.2} />
      <g className="ti-sparkle" fill={ACCENT} stroke="none">
        <path d="m19 3.2.65 1.75 1.75.65-1.75.65L19 8l-.65-1.75-1.75-.65 1.75-.65z" />
        <path d="m4.8 6.5.4 1.05 1.05.4-1.05.4-.4 1.05-.4-1.05-1.05-.4 1.05-.4z" />
      </g>
    </svg>
  );
}

function Tattoo({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M12 20.3s-7.2-4.2-7.2-9.4A3.9 3.9 0 0 1 12 8.7a3.9 3.9 0 0 1 7.2 2.2c0 5.2-7.2 9.4-7.2 9.4z"
        fill={ACCENT}
        fillOpacity={0.9}
        stroke={ACCENT}
      />
      <path d="M12 20.3s-7.2-4.2-7.2-9.4A3.9 3.9 0 0 1 12 8.7a3.9 3.9 0 0 1 7.2 2.2c0 5.2-7.2 9.4-7.2 9.4z" />
      <path d="M2.8 12.6h18.4l-1.3 1.8 1.3 1.8H2.8l1.3-1.8z" fill="var(--icon-bg)" />
      <path d="M7.5 14.4h9" strokeWidth={1.1} strokeDasharray="1.6 1.3" />
      <path d="m19.5 3 .7 1.9M22 5.2l-1.8.3M17.3 4.1l1.1 1.5" strokeWidth={1.2} />
    </svg>
  );
}

function Laundromat({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.8" y="3.5" width="14.4" height="17.5" rx="2" />
      <path d="M3.8 7.2h14.4" />
      <circle cx="6.6" cy="5.4" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="5.4" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="11" cy="14" r="4.4" />
      <path d="M7.1 14.6c1.3-.9 2.6.9 3.9 0s2.6.9 3.9 0" strokeWidth={1.2} />
      <g className="ti-bubbles" stroke={ACCENT} strokeWidth={1.1}>
        <circle cx="20.4" cy="3.2" r="1.3" />
        <circle cx="21.4" cy="7.2" r="0.8" />
        <circle cx="10" cy="12.4" r="0.6" />
      </g>
      <path
        d="M16.6 17.8h2.1v2.6a1.3 1.3 0 0 1-1.3 1.3h-2.5a1 1 0 0 1 0-2h1.7z"
        fill={ACCENT}
        stroke={ACCENT}
        strokeWidth={0.9}
      />
    </svg>
  );
}

const ICONS: Record<BusinessType, (p: IconProps) => React.JSX.Element> = {
  "coffee shop": Coffee,
  "food truck": FoodTruck,
  "boutique retail": Boutique,
  "med spa": MedSpa,
  "tattoo shop": Tattoo,
  laundromat: Laundromat,
};

export function TypeIcon({ type, className = "h-5 w-5" }: { type: BusinessType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon className={`type-icon ${className}`} />;
}
