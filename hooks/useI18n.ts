import { useMemo } from "react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { createTranslator, type TranslationValues } from "@/lib/i18n";

export function useI18n() {
  const { language } = useGlobalSettings();
  return useMemo(
    () => (key: string, values?: TranslationValues) => createTranslator(language)(key, values),
    [language],
  );
}
