import { useCallback, useEffect, useState } from 'react';

export type Route = 'guide' | 'foods' | 'meal' | 'metabolism' | 'methodology';
const ROUTES: Route[] = ['guide', 'foods', 'meal', 'metabolism', 'methodology'];

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'foods';
}

/** Hash-based routing: works on GitHub Pages sub-paths with no server rewrites. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((r: Route) => {
    window.location.hash = `/${r}`;
    window.scrollTo({ top: 0 });
  }, []);
  return [route, navigate];
}
