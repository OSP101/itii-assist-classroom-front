export const APPEARANCE_HINT_COOKIE_NAME = "appearance-hint";

export type AppearanceHintTheme = "system" | "light" | "dark";
export type AppearanceHintResolvedTheme = "light" | "dark";
export type AppearanceHintFontSize = "sm" | "md" | "lg";
export type AppearanceHintLanguage = "th" | "en";
export type AppearanceHintRole = "staff";

export interface AppearanceHint {
  theme?: AppearanceHintTheme;
  resolvedTheme?: AppearanceHintResolvedTheme;
  fontSize?: AppearanceHintFontSize;
  language?: AppearanceHintLanguage;
  themeRole?: AppearanceHintRole;
}

export function parseAppearanceHintCookieValue(value?: string | null): AppearanceHint | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as AppearanceHint;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeAppearanceHintCookieValue(value: AppearanceHint): string {
  return encodeURIComponent(JSON.stringify(value));
}

export function buildAppearanceHintCookieString(value: AppearanceHint): string {
  return `${APPEARANCE_HINT_COOKIE_NAME}=${serializeAppearanceHintCookieValue(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function clearAppearanceHintCookieString(): string {
  return `${APPEARANCE_HINT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}