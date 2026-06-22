import { API_BASE_URL } from "@/config/api";

export function getBackendPublicAssetUrl(pathOrUrl?: string | null): string {
  const value = String(pathOrUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const apiBase = API_BASE_URL.replace(/\/$/, "");
  const origin = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${origin}${normalizedPath}`;
}
