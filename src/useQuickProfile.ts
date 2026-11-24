import { useEffect, useRef, useState } from 'react';
import { routeHref, type Route } from './navigation';
const key = 'apartmanResidentPanel';
/** A same-URL history entry lets Back dismiss the sheet without unmounting chat. */
export function useQuickProfile(identity?: string) {
  const [userId, setUserId] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const sync = () => {
      const saved = history.state?.[key];
      setUserId(identity && saved?.identity === identity && typeof saved.userId === 'string' ? saved.userId : null);
    };
    const hash = () => { setUserId(null); if (history.state?.[key]) history.replaceState(null, ''); };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', hash);
    sync();
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', hash); };
  }, [identity]);
  const open = (id: string, element: HTMLElement) => {
    opener.current = element;
    history.pushState({[key]:{identity,userId:id}}, '', location.href);
    setUserId(id);
  };
  const close = () => {
    if (history.state?.[key]) history.back();
    else setUserId(null);
  };
  const navigate = (destination?: Route) => {
    // Replace just the transient entry before the link's normal hash navigation.
    if (history.state?.[key]) history.replaceState(null, '');
    setUserId(null);
    if (destination?.target && routeHref(destination) === location.hash) {
      // Re-selecting the current hash still requests a real target, after modal
      // cleanup restores the opener. Do not let that cleanup override this focus.
      requestAnimationFrame(() => {
        const target = document.getElementById(destination.target!);
        target?.scrollIntoView({block:'start'});
        target?.focus({preventScroll:true});
      });
    }
  };
  return {userId, opener, open, close, navigate};
}
