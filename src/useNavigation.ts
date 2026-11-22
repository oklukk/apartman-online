import { useEffect, useState } from 'react';
import { parseRoute } from './navigation';
export function useNavigation() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  // Runs after route content mounts, including after async game data arrives.
  return route;
}
