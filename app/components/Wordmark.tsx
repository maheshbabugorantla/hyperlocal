/**
 * "Hyperlocal" as a title card: "Hyper" leans forward in a soft, wonky Fraunces italic;
 * "local" stands upright and gets a hand-drawn marigold swash that ends in a map-pin dot.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark relative inline-flex items-baseline leading-none text-brand-deep ${className}`}>
      <span className="wordmark-hyper">Hyper</span>
      <span className="wordmark-local relative">
        local
        <svg
          aria-hidden="true"
          viewBox="0 0 100 16"
          preserveAspectRatio="none"
          className="pointer-events-none absolute -bottom-[0.3em] -left-[0.04em] h-[0.34em] w-[1.06em] overflow-visible"
          style={{ width: "calc(100% + 0.08em)" }}
        >
          <path
            d="M2 11.5C18 6.5 38 4.2 58 5.2c14 .7 25 2.6 33 4.6"
            fill="none"
            stroke="var(--icon-accent)"
            strokeWidth="3.4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* the pin dot where the swash lands */}
        <span
          aria-hidden="true"
          className="absolute -right-[0.2em] -bottom-[0.14em] h-[0.17em] w-[0.17em] rounded-full"
          style={{ background: "var(--icon-accent)" }}
        />
      </span>
    </span>
  );
}
