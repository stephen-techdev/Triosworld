export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tightest ${className}`}>
      TRIO<span className="text-lime">S</span>WORLD
    </span>
  );
}

export function TriosMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="16" cy="24" r="12" fill="currentColor" />
      <circle cx="32" cy="24" r="12" fill="currentColor" className="opacity-60" />
      <circle cx="24" cy="12" r="12" fill="currentColor" className="opacity-30" />
    </svg>
  );
}
