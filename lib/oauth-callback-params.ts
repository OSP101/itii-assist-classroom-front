function normalizeCallbackParam(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (lowered === "undefined" || lowered === "null") {
    return null;
  }

  return normalized;
}

export function getOAuthCallbackParam(searchParams: URLSearchParams, key: string): string | null {
  if (typeof window !== "undefined") {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const fragmentParams = new URLSearchParams(hash);
    const fragmentValue = normalizeCallbackParam(fragmentParams.get(key));
    if (fragmentValue) {
      return fragmentValue;
    }
  }

  return normalizeCallbackParam(searchParams.get(key));
}
