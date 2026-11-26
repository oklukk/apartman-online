export type Theme = 'system' | 'light' | 'dark';
export type Appearance = { textSize: 'normal' | 'large'; density: 'standard' | 'compact'; reduceMotion: boolean };
export const appearanceDefaults: Appearance = {textSize:'normal',density:'standard',reduceMotion:false};
export const appearanceKey = 'apartman-appearance';
export const themeKey = 'apartman-theme'; // Preserve the existing device preference.
export function normalizeTheme(value: unknown): Theme { return value === 'light' || value === 'dark' ? value : 'system'; }
export function normalizeAppearance(value: unknown): Appearance {
  const data = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  return {textSize:data.textSize === 'large' ? 'large' : 'normal',density:data.density === 'compact' ? 'compact' : 'standard',reduceMotion:data.reduceMotion === true};
}
export function readAppearance(storage: Pick<Storage,'getItem'>): {theme:Theme;appearance:Appearance} {
  let theme: Theme = 'system', appearance = {...appearanceDefaults};
  try { theme = normalizeTheme(storage.getItem(themeKey)); } catch { /* Device storage is optional. */ }
  try { const raw = JSON.parse(storage.getItem(appearanceKey) || '{}'); if (raw?.version === 1) appearance = normalizeAppearance(raw); } catch { /* Invalid or denied storage uses defaults. */ }
  return {theme,appearance};
}
export function saveAppearance(storage: Pick<Storage,'setItem'>, theme: Theme, appearance: Appearance): boolean {
  try {
    storage.setItem(themeKey,normalizeTheme(theme));
    storage.setItem(appearanceKey,JSON.stringify({version:1,...normalizeAppearance(appearance)}));
    return true;
  } catch { return false; }
}
