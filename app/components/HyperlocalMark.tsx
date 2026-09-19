/**
 * Hyperlocal mark: a map pin holding a tiny storefront with a scalloped awning,
 * plus a sparkle ("the right spot"). Same geometric-signage language as TypeIcons:
 * currentColor body, one marigold accent via --icon-accent.
 */
export function HyperlocalMark({ className }: { className?: string }) {
  const accent = { fill: "var(--icon-accent, #D9822B)" } as const;
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className} fill="none">
      {/* pin */}
      <path d="M15 30.2S5.5 21.6 5.5 13.8a9.5 9.5 0 0 1 19 0c0 7.8-9.5 16.4-9.5 16.4z" fill="currentColor" />
      {/* storefront body */}
      <rect x="9.6" y="13.2" width="10.8" height="7.6" rx="1" fill="#fff" />
      {/* door */}
      <rect x="13.4" y="16" width="3.2" height="4.8" rx="0.6" fill="currentColor" />
      {/* scalloped awning */}
      <path
        d="M8.8 10.2h12.4v2.6a1.55 1.55 0 0 1-3.1 0 1.55 1.55 0 0 1-3.1 0 1.55 1.55 0 0 1-3.1 0 1.55 1.55 0 0 1-3.1 0z"
        style={accent}
      />
      {/* sparkle */}
      <path d="M27 2.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" style={accent} />
    </svg>
  );
}
