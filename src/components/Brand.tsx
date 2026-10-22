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

/**
 * Instagram's camera glyph in the brand's own gradient.
 *
 * The footer row used a monochrome line icon, which reads as a generic
 * "social" shape and does not say Instagram at a glance. This is the real
 * mark — rounded square, lens, flash dot — painted with the official
 * yellow → orange → pink → purple → blue ramp, so it stays recognisable
 * even at 18px on the dark footer.
 */
export function InstagramGlyph({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient
          id="trios-instagram-gradient"
          x1="2"
          y1="22"
          x2="22"
          y2="2"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#feda75" />
          <stop offset="0.28" stopColor="#fa7e1e" />
          <stop offset="0.52" stopColor="#d62976" />
          <stop offset="0.74" stopColor="#962fbf" />
          <stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect
        x="2.4"
        y="2.4"
        width="19.2"
        height="19.2"
        rx="5.6"
        stroke="url(#trios-instagram-gradient)"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="4.5"
        stroke="url(#trios-instagram-gradient)"
        strokeWidth="2"
      />
      <circle cx="17.45" cy="6.55" r="1.3" fill="url(#trios-instagram-gradient)" />
    </svg>
  );
}

/**
 * WhatsApp: the official green speech bubble with the white handset.
 * Paths are the brand artwork (Wikimedia, CC0), flattened to two fills so no
 * filter or gradient filter has to run for an 18px footer icon.
 */
export function WhatsAppGlyph({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 175.216 175.552"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        fill="#25d366"
        d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z"
      />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647"
      />
    </svg>
  );
}

/**
 * Gmail: the official four-colour envelope (blue, green, yellow, two reds).
 * Wide artwork, so it is vertically centred inside the square button.
 */
export function GmailGlyph({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="52 42 88 66"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
    </svg>
  );
}

/** Facebook: the 2023 blue disc with the white "f". */
export function FacebookGlyph({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="12" cy="12" r="12" fill="#1877f2" />
      <path
        fill="#fff"
        d="M16.671 15.469 17.203 12h-3.297V9.75c0-.949.465-1.874 1.956-1.874h1.5V4.922s-1.361-.232-2.661-.232c-2.715 0-4.489 1.645-4.489 4.625V12H7.078v3.469h3.134v8.385c.63.099 1.275.152 1.933.152.658 0 1.303-.053 1.933-.152v-8.385z"
      />
    </svg>
  );
}

/** YouTube: the red rounded screen with the white play triangle. */
export function YouTubeGlyph({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#ff0000" />
      <path fill="#fff" d="M10 9.2v5.6l4.8-2.8z" />
    </svg>
  );
}