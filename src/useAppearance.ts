import {useEffect,useState} from 'react';
import {appearanceDefaults,appearanceKey,themeKey,normalizeTheme,readAppearance,saveAppearance,type Appearance} from './appearance';
function devicePreferences() {
  try { return readAppearance(window.localStorage); }
  catch { return {theme:normalizeTheme(null),appearance:{...appearanceDefaults}}; }
}
export function useAppearance() {
  const [initial] = useState(devicePreferences);
  const [theme, updateTheme] = useState(initial.theme);
  const [appearance, setAppearance] = useState<Appearance>(initial.appearance);
  const [canPersist, setCanPersist] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.textSize = appearance.textSize;
    root.dataset.density = appearance.density;
    root.dataset.motion = appearance.reduceMotion ? 'reduce' : 'system';
    try { setCanPersist(saveAppearance(window.localStorage,theme,appearance)); } catch { setCanPersist(false); }
  }, [theme,appearance]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== null && event.key !== themeKey && event.key !== appearanceKey) return;
      const next = devicePreferences();
      updateTheme(next.theme);setAppearance(next.appearance);
    };
    window.addEventListener('storage',sync);
    return () => window.removeEventListener('storage',sync);
  }, []);
  return {theme,setTheme:(value:string)=>updateTheme(normalizeTheme(value)),appearance,setAppearance,canPersist};
}
