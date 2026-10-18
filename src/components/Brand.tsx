/**
 * TriosWorld brand mark.
 *
 * Recreated from the supplied artwork: a winged "TW" monogram — two swept
 * crossbars over two tapered stems — paired with a wide, industrial "TRIO"
 * wordmark, finished in brushed chrome.
 *
 * Chrome reads well on the dark surfaces (footer, admin chrome). On the ivory
 * storefront header a silver gradient washes out, so the same artwork is also
 * offered as flat graphite via `variant="ink"`. Both share identical geometry,
 * so the logo is recognisably the same object in every context.
 */

type Variant = 'chrome' | 'ink';

/** Gradient stops shared by every chrome surface, so the metal reads continuous. */
const chromeStops = (
  <>
    <stop offset="0%" stopColor="#ffffff" />
    <stop offset="18%" stopColor="#e8eaee" />
    <stop offset="34%" stopColor="#a9aeb6" />
    <stop offset="48%" stopColor="#f2f4f7" />
    <stop offset="62%" stopColor="#8f959e" />
    <stop offset="78%" stopColor="#dfe2e7" />
    <stop offset="100%" stopColor="#9aa0a8" />
  </>
);

function usePaint(variant: Variant, id: string) {
  return variant === 'chrome' ? `url(#${id})` : 'currentColor';
}

/**
 * The winged TW monogram.
 *
 * Two swept wings form the T crossbars; two stems taper down and slightly
 * outward, the lower-left one longer, which is what gives the mark its
 * forward-leaning, wing-like read.
 */
export function TwMonogram({
  className = '',
  variant = 'chrome',
  title = 'TriosWorld',
}: {
  className?: string;
  variant?: Variant;
  title?: string;
}) {
  const gradId = `tw-chrome-${variant}`;
  const paint = usePaint(variant, gradId);

  return (
    <svg
      viewBox="0 0 128 100"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      {variant === 'chrome' && (
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="12%" y2="100%">
            {chromeStops}
          </linearGradient>
        </defs>
      )}

      {/* Upper wing — the wide, rising crossbar. */}
      <path
        d="M6 14 C 32 4, 56 12, 70 28 C 80 39, 96 38, 124 10
           C 108 42, 84 56, 66 48 C 50 41, 28 32, 6 34 Z"
        fill={paint}
      />
      {/* Lower wing — shorter, tucked beneath the first. */}
      <path
        d="M12 42 C 32 36, 48 42, 60 54 C 68 62, 78 62, 100 46
           C 88 68, 70 78, 56 72 C 44 67, 28 60, 12 62 Z"
        fill={paint}
        opacity={variant === 'chrome' ? 0.94 : 0.6}
      />
      {/* Stems — tapered, descending from the wing junction. */}
      <path
        d="M60 48 C 63 62, 63 78, 62 96 C 55 92, 51 80, 51 66 C 51 57, 54 50, 60 48 Z"
        fill={paint}
      />
      <path
        d="M94 40 C 98 54, 99 70, 98 88 C 91 84, 88 72, 88 58 C 88 49, 90 42, 94 40 Z"
        fill={paint}
        opacity={variant === 'chrome' ? 0.94 : 0.6}
      />
    </svg>
  );
}

/**
 * Full lockup: monogram + "TRIO".
 *
 * The lettering is drawn rather than set in a font so the wordmark keeps the
 * wide, squared, industrial proportions of the original at any size, and so it
 * never falls back to a different typeface if the webfont fails to load.
 */
export function Wordmark({
  className = '',
  variant = 'chrome',
  showMonogram = true,
}: {
  className?: string;
  variant?: Variant;
  showMonogram?: boolean;
}) {
  const gradId = `tw-chrome-word-${variant}`;
  const paint = usePaint(variant, gradId);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {showMonogram && <TwMonogram variant={variant} className="h-[1.15em] w-auto shrink-0" title="" />}

      <svg
        viewBox="0 0 300 84"
        className="h-[0.8em] w-auto shrink-0"
        role="img"
        aria-label="TRIO"
      >
        {variant === 'chrome' && (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
              {chromeStops}
            </linearGradient>
          </defs>
        )}

        {/* T */}
        <path
          d="M8 8 H74 V24 H50 V76 H32 V24 H8 Z"
          fill={paint}
        />
        {/* R */}
        <path
          d="M92 8 H142 C 166 8, 180 20, 180 36 C 180 50, 170 60, 154 64
             L182 76 H154 L130 66 H116 V76 H92 Z
             M116 24 V50 H140 C 150 50, 156 45, 156 37 C 156 29, 150 24, 140 24 Z"
          fill={paint}
          fillRule="evenodd"
        />
        {/* I */}
        <path
          d="M198 8 H222 V76 H198 Z"
          fill={paint}
        />
        {/* O */}
        <path
          d="M262 8 C 284 8, 298 22, 298 42 C 298 62, 284 76, 262 76
             C 240 76, 226 62, 226 42 C 226 22, 240 8, 262 8 Z
             M262 24 C 252 24, 248 32, 248 42 C 248 52, 252 60, 262 60
             C 272 60, 276 52, 276 42 C 276 32, 272 24, 262 24 Z"
          fill={paint}
          fillRule="evenodd"
        />
      </svg>
    </span>
  );
}

/**
 * Small standalone mark for tight spots — favicon, social preview, the tick
 * beside the footer wordmark. No wordmark, no accessibility noise.
 */
export function TriosMark({ className = '' }: { className?: string }) {
  return <TwMonogram className={className} variant="chrome" title="" />;
}