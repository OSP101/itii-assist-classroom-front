export function getOAuthCallbackParam(searchParams: URLSearchParams, key: string): string | null {
  if (typeof window !== "undefined") {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const fragmentParams = new URLSearchParams(hash);
    const fragmentValue = fragmentParams.get(key);
    if (fragmentValue) {
      return fragmentValue;
    }
  }

  return searchParams.get(key);
}
