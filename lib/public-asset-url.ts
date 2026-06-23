import { getAppOrigin } from "@/lib/app-url";

export function getBackendPublicAssetUrl(pathOrUrl?: string | null): string {
  const value = String(pathOrUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${getAppOrigin()}${normalizedPath}`;
}
