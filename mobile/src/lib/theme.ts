// Two palettes (dark / light). `C` is mutated in place by applyScheme(), then the whole tree is
// remounted by ThemeProvider, so every component simply reads C.* at render time.
export const DARK = {
  bg: '#0E0F13', card: '#15171C', surface: '#15171C', surface2: '#1C1F26', panel: '#171A20', line: '#22252D', track: '#23262F',
  text: '#F3F4F6', muted: '#8A8F9C', primary: '#8B7CFF', primaryInk: '#FFFFFF', ok: '#3DD9A0', warn: '#FF9F6A', danger: '#FF6B81',
  overlay: '#000000b3',
};
export const LIGHT: typeof DARK = {
  bg: '#FFFFFF', card: '#F4F5F7', surface: '#F4F5F7', surface2: '#ECEEF1', panel: '#FFFFFF', line: '#E6E8EC', track: '#E7E9EE',
  text: '#14151A', muted: '#6B7280', primary: '#6D5EF5', primaryInk: '#FFFFFF', ok: '#12A874', warn: '#E8702A', danger: '#E5484D',
  overlay: '#00000066',
};
export type Palette = typeof DARK;
export type Scheme = 'dark' | 'light';

export const C: Palette = { ...DARK };
export function applyScheme(scheme: Scheme) {
  Object.assign(C, scheme === 'light' ? LIGHT : DARK);
}

/** Folder / habit accent colors (same in both themes; tinted at low opacity behind icons). */
export const ACCENTS = {
  violet: '#8B7CFF', blue: '#4F9BFF', cyan: '#22B8E0', green: '#2FCB94', yellow: '#E9A93A', orange: '#FF8F5A', red: '#F2566B', pink: '#F25DA0',
} as const;
export type AccentName = keyof typeof ACCENTS;
