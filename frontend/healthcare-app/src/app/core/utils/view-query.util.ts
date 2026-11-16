import { ActivatedRoute, Router } from '@angular/router';

/** Reads a query parameter if it matches an allowed value; otherwise returns the fallback. */
export function readValidQueryParam<T extends string>(
  route: ActivatedRoute,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const value = route.snapshot.queryParamMap.get(key) as T | null;
  return value && allowed.includes(value) ? value : fallback;
}

/** Updates a single query parameter in place without adding a duplicate history entry. */
export function writeQueryParam(
  router: Router,
  route: ActivatedRoute,
  key: string,
  value: string
): void {
  router.navigate([], {
    relativeTo: route,
    queryParams: { [key]: value },
    queryParamsHandling: 'merge',
    replaceUrl: true
  });
}
