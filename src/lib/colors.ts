/**
 * The single colour table for the whole app.
 *
 * The operator types a colour *name* in the product form ("Red", "Bottle
 * Green", "Off-white"). Everything downstream — the dashboard swatch, the card
 * swatch, the shop's colour filter and the selector on the product page —
 * paints from the *hex* this file resolves for that name, so all four surfaces
 * can never disagree. The database copy (`color_hex_for`) mirrors this list for
 * rows written before the picker existed.
 *
 * Unknown names deliberately resolve to `null`: a new colour the operator
 * invents keeps whatever hex they choose in the picker instead of being
 * silently rewritten to black.
 */

/** Keys are normalised (lower case, letters and digits only). */
const COLOR_HEXES: Record<string, string> = {
  // Neutrals
  black: '#171717',
  onyx: '#171717',
  charcoal: '#2d2d2d',
  graphite: '#4a4a4a',
  slate: '#5a6070',
  grey: '#9a9a9a',
  gray: '#9a9a9a',
  silver: '#c7c7c7',
  steel: '#8a8f98',
  stone: '#ddd8ce',
  concrete: '#b8b3a8',
  ash: '#b5b5b0',
  smoke: '#9b9b96',
  white: '#ffffff',
  ivory: '#f7f5f0',
  cream: '#efe9dc',
  offwhite: '#f7f5f0',
  linen: '#ece6da',
  bone: '#e8e0d0',
  ecru: '#e5dcc8',
  beige: '#d8c4a0',
  sand: '#d8c4a0',
  sandbeige: '#cdbfa0',
  khaki: '#c3b48b',
  taupe: '#9c8a7a',
  mushroom: '#a89684',
  camel: '#c49a6c',
  tan: '#c49a6c',
  brown: '#6b4a35',
  chocolate: '#4a2e1f',
  coffee: '#5a4232',
  mocha: '#6f5443',
  cocoa: '#5d4033',
  caramel: '#b5875a',
  caramelbrown: '#b5875a',

  // Reds
  red: '#a5281b',
  crimson: '#a31621',
  scarlet: '#c2181b',
  cherry: '#b01030',
  ruby: '#91152f',
  wine: '#5e1f2a',
  maroon: '#5e1f2a',
  burgundy: '#5e1f2a',
  brick: '#9c4a3a',
  rust: '#9e4a2e',
  terracotta: '#b4633f',
  coral: '#f0715a',
  salmon: '#f08080',
  peach: '#f4a58a',
  pink: '#e8a2b8',
  blush: '#f3c9c2',
  rose: '#d98a9a',
  fuchsia: '#c7387a',
  magenta: '#b5217a',

  // Oranges & yellows
  orange: '#d96a2a',
  amber: '#d98a1a',
  mustard: '#c8a415',
  gold: '#c9a227',
  yellow: '#e8c33c',
  lemon: '#e8d65c',
  banana: '#f2e07a',

  // Greens
  green: '#4a6741',
  forest: '#2f4f33',
  bottle: '#2f5d3a',
  bottlegreen: '#2f5d3a',
  emerald: '#1f7a4d',
  jade: '#3a9a70',
  mint: '#a8d8c0',
  seafoam: '#9fcdb7',
  olive: '#5b5f3a',
  khakigreen: '#6f7045',
  sage: '#9caf88',
  pistachio: '#b8cf9e',
  lime: '#b7ff43',
  parrot: '#8fbf3f',
  moss: '#6b7f4a',
  teal: '#2f7f7f',
  turquoise: '#3fb0a8',
  aqua: '#7fd8d8',

  // Blues
  blue: '#2b4cb8',
  cobalt: '#2b4cb8',
  royal: '#2a4fa8',
  royalblue: '#2a4fa8',
  navy: '#1f2a44',
  midnight: '#16213e',
  indigo: '#3730a3',
  denim: '#45618f',
  sky: '#87bde0',
  babyblue: '#a9cbe8',
  azure: '#2f8fd9',
  steelblue: '#456b8c',
  powder: '#c2d9ee',

  // Purples
  purple: '#6b3fa0',
  violet: '#7c4db0',
  lavender: '#b8a8d8',
  lilac: '#c6b3e0',
  plum: '#5e2a6e',
  mauve: '#a67b9b',

  // Misc
  multi: '#171717',
  transparent: '#ffffff',
};

function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Resolve a colour name to a hex string, or `null` when the name is not in the
 * table (so the picker's colour wins for invented names).
 */
export function hexForColorName(raw: string): string | null {
  const key = normalise(raw);
  if (!key) return null;

  const exact = COLOR_HEXES[key];
  if (exact) return exact;

  // "Bottle Green", "dark blue", "wash blue" — take the last recognised word,
  // which is the one that actually names the colour. "dark" alone would be a
  // miss, so it falls through to the whole-string match above.
  const words = raw.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const hit = COLOR_HEXES[normalise(words[i])];
    if (hit) return hit;
  }

  // "Off white" / "lightblue" style compound names with no word boundary.
  for (const key2 of Object.keys(COLOR_HEXES)) {
    if (key.length > 3 && key.includes(key2)) return COLOR_HEXES[key2];
  }

  return null;
}

/** The colour name the table would use for a hex — used by swatch helpers. */
export const KNOWN_COLOR_NAMES = Object.keys(COLOR_HEXES);

export default COLOR_HEXES;
