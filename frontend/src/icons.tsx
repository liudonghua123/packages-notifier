/* Dynamic SVG icon set — every icon has a subtle idle animation
   driven by CSS (see .di-* rules in index.css).
   Animations pause on prefers-reduced-motion. */

const common = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* Home — roof line draws in a loop, gentle chimney smoke puff */
export function HomeIcon() {
  return (
    <svg {...common} className="di di-home">
      <path className="di-home-roof" d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <circle className="di-home-spark" cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* Search — handle sweeps, glass pulses */
export function SearchIcon() {
  return (
    <svg {...common} className="di di-search">
      <circle cx="11" cy="11" r="7" />
      <path className="di-search-handle" d="m21 21-4.3-4.3" />
    </svg>
  );
}

/* List — lines slide in one after another */
export function ListIcon() {
  return (
    <svg {...common} className="di di-list">
      <path className="di-list-l1" d="M4 5h16" />
      <path className="di-list-l2" d="M4 12h16" />
      <path className="di-list-l3" d="M4 19h10" />
    </svg>
  );
}

/* Gear — slow continuous rotation */
export function GearIcon() {
  return (
    <svg {...common} className="di di-gear">
      <g className="di-gear-rot">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
      </g>
    </svg>
  );
}

/* Sun — rays rotate slowly, core breathes */
export function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="di di-sun">
      <g className="di-sun-rays">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </g>
    </svg>
  );
}

/* Moon — twinkles with two stars */
export function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="di di-moon">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      <circle className="di-moon-s1" cx="18" cy="5" r="0.9" fill="currentColor" stroke="none" />
      <circle className="di-moon-s2" cx="21.5" cy="9" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* Check — draws itself in a loop */
export function CheckIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="di di-check">
      <path className="di-check-path" d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* Mail — flag on envelope waves */
export function MailIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="di di-mail">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
      <circle className="di-mail-dot" cx="19.5" cy="5.5" r="2.2" fill="var(--accent-2)" stroke="none" />
    </svg>
  );
}
