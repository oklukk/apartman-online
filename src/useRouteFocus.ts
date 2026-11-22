import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { routeHref, type Route } from './navigation';
const missingTarget = 'Bu işlem bağlantısı artık geçerli olmayabilir veya bu içeriğe erişimin yok. İlgili bölümdeki güncel kayıtları inceleyebilirsin.';
/** Focus once per requested route, retrying when asynchronous content arrives. */
export function useRouteFocus(route: Route, ready: boolean, revision: unknown, identity: string | undefined, setNotice: Dispatch<SetStateAction<string>>) {
  const handled = useRef({ key: '', done: false });
  useEffect(() => {
    const key = (identity || '') + routeHref(route);
    if (handled.current.key !== key) handled.current = { key, done: false };
    if (!ready || handled.current.done) return;
    let observer: MutationObserver | undefined;
    const attempt = () => {
      if (handled.current.done) return true;
      const target = route.target ? document.getElementById(route.target) : document.querySelector<HTMLElement>('main h1');
      if (!target || target.closest('[hidden]')) return false;
      handled.current.done = true;
      observer?.disconnect();
      if (route.target) target.scrollIntoView({ block:'start' });
      else { target.tabIndex = -1; window.scrollTo({ top:0 }); }
      target.focus({ preventScroll:true });
      setNotice(value => value === missingTarget ? '' : value);
      return true;
    };
    if (attempt()) return;
    // Observe only insertion/removal, not focus/style changes. No data fetching.
    observer = new MutationObserver(attempt);
    observer.observe(document.getElementById('main-content') || document.body, { childList:true, subtree:true });
    const timer = window.setTimeout(() => {
      if (!attempt() && route.target) setNotice(missingTarget);
    }, 2500);
    return () => { observer?.disconnect(); window.clearTimeout(timer); };
  }, [route, ready, revision, identity, setNotice]);
}
