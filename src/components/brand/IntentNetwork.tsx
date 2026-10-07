/** Decorative network motif, not simulated community activity. */
export function IntentNetwork() {
  return (
    <svg width="220" height="110" viewBox="0 0 220 110" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth=".8">
        <path d="M24 24 110 55 190 18M24 86 110 55 198 88M110 55 118 10M110 55v45" />
        <circle cx="110" cy="55" r="23" />
        <circle cx="110" cy="55" r="16" />
        <path d="M96 55h28M110 41v28M100 45l20 20M120 45l-20 20" />
        <path d="M17 17h14v14H17zM183 11h14v14h-14zM17 79h14v14H17zM191 81h14v14h-14z" />
      </g>
      <g fill="currentColor">
        <circle cx="110" cy="55" r="4" />
        <circle cx="118" cy="10" r="2" />
        <circle cx="110" cy="100" r="2" />
      </g>
    </svg>
  );
}
