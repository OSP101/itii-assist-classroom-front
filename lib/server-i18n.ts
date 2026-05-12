import { cookies } from "next/headers";

import {
  APPEARANCE_HINT_COOKIE_NAME,
  parseAppearanceHintCookieValue,
} from "@/lib/appearance-hint";
import { createTranslator, type AppLanguage } from "@/lib/i18n";

export async function getRequestLanguage(): Promise<AppLanguage> {
  const cookieStore = await cookies();
  const appearanceHint = parseAppearanceHintCookieValue(
    cookieStore.get(APPEARANCE_HINT_COOKIE_NAME)?.value,
  );

  return appearanceHint?.language === "en" ? "en" : "th";
}

export async function getServerTranslator() {
  return createTranslator(await getRequestLanguage());
}