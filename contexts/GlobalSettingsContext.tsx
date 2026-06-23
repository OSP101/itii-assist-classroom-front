"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  authService,
  AUTH_USER_UPDATED_EVENT,
  PENDING_PREFERENCES_STORAGE_KEY,
  type User,
  type UserPreferences,
} from "@/services/auth.service";
import {
  APPEARANCE_HINT_COOKIE_NAME,
  buildAppearanceHintCookieString,
  parseAppearanceHintCookieValue,
} from "@/lib/appearance-hint";

export type Language = "th" | "en";
export type FontSize = "sm" | "md" | "lg";
export type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

export interface InitialGlobalSettings {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  fontSize: FontSize;
  language: Language;
}

const DEFAULT_SETTINGS = {
  theme: "system" as ThemePreference,
  fontSize: "md" as FontSize,
  language: "th" as Language,
};

const ROOT_THEME_PALETTE: Record<ResolvedTheme, { background: string; foreground: string }> = {
  light: {
    background: "#f4f7fb",
    foreground: "#0f172a",
  },
  dark: {
    background: "#0b1220",
    foreground: "#e7edf7",
  },
};

export interface GlobalSettings {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isLoading: boolean;
  isSaving: boolean;
  syncError: string | null;
  setTheme: (theme: ThemePreference) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const GlobalSettingsContext = createContext<GlobalSettings | undefined>(undefined);

export const useGlobalSettings = () => {
  const ctx = useContext(GlobalSettingsContext);
  if (!ctx) throw new Error("useGlobalSettings must be used within GlobalSettingsProvider");
  return ctx;
};

function normalizeInitialSettings(initialSettings: InitialGlobalSettings): InitialGlobalSettings {
  return {
    theme: normalizeThemePreference(initialSettings.theme),
    resolvedTheme: initialSettings.resolvedTheme === "dark" ? "dark" : "light",
    fontSize: normalizeFontSizePreference(initialSettings.fontSize),
    language: normalizeLanguagePreference(initialSettings.language),
  };
}

function normalizeThemePreference(value?: string): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return DEFAULT_SETTINGS.theme;
}

function normalizeFontSizePreference(value?: string): FontSize {
  if (value === "sm" || value === "md" || value === "lg") {
    return value;
  }

  return DEFAULT_SETTINGS.fontSize;
}

function normalizeLanguagePreference(value?: string): Language {
  if (value === "th" || value === "en") {
    return value;
  }

  return DEFAULT_SETTINGS.language;
}

function normalizePreferences(preferences?: Partial<UserPreferences> | null) {
  return {
    theme: normalizeThemePreference(preferences?.theme),
    fontSize: normalizeFontSizePreference(preferences?.fontSize),
    language: normalizeLanguagePreference(preferences?.language),
  };
}

function serializePreferences(preferences: {
  theme: ThemePreference;
  fontSize: FontSize;
  language: Language;
}) {
  return JSON.stringify(preferences);
}

function getConfirmedStoredPreferencesSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  const storedUser = authService.getStoredUser();

  if (storedUser?.preferences) {
    return normalizePreferences(storedUser.preferences);
  }

  const appearanceHintCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${APPEARANCE_HINT_COOKIE_NAME}=`))
    ?.slice(APPEARANCE_HINT_COOKIE_NAME.length + 1);
  const appearanceHint = parseAppearanceHintCookieValue(appearanceHintCookie ?? null);

  return normalizePreferences({
    theme: appearanceHint?.theme,
    fontSize: appearanceHint?.fontSize,
    language: appearanceHint?.language,
  });
}

function getCachedPreferencesSnapshot(user?: User | null) {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  const storedUser = user ?? authService.getStoredUser();

  if (!storedUser) {
    return getConfirmedStoredPreferencesSnapshot();
  }

  const pendingPreferences = storedUser ? authService.getPendingPreferences(storedUser.id) : null;

  return normalizePreferences({
    ...storedUser?.preferences,
    ...pendingPreferences,
  });
}

function getInitialResolvedTheme(themePreference: ThemePreference): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  if (themePreference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return themePreference;
}

function persistAppearanceHintCookie(
  preferences: {
    theme: ThemePreference;
    fontSize: FontSize;
    language: Language;
  },
  resolvedTheme: ResolvedTheme,
) {
  if (typeof document === "undefined") {
    return;
  }

  const storedUser = authService.getStoredUser();
  const isStaffRole =
    storedUser?.role === "admin" || storedUser?.role === "instructor" || storedUser?.role === "ta";

  document.cookie = buildAppearanceHintCookieString({
    theme: preferences.theme,
    resolvedTheme,
    fontSize: preferences.fontSize,
    language: preferences.language,
    themeRole: isStaffRole ? "staff" : undefined,
  });
}

export const GlobalSettingsProvider: React.FC<{
  children: React.ReactNode;
  initialSettings?: InitialGlobalSettings;
}> = ({ children, initialSettings }) => {
  const pathname = usePathname();
  const isStudentThemeLocked = pathname?.startsWith("/student") ?? false;
  const normalizedInitialSettings = initialSettings
    ? normalizeInitialSettings(initialSettings)
    : null;
  const initialPreferencesRef = useRef(
    normalizedInitialSettings
      ? {
          theme: normalizedInitialSettings.theme,
          fontSize: normalizedInitialSettings.fontSize,
          language: normalizedInitialSettings.language,
        }
      : getCachedPreferencesSnapshot(),
  );
  const [theme, setThemeState] = useState<ThemePreference>(initialPreferencesRef.current.theme);
  const [fontSize, setFontSizeState] = useState<FontSize>(initialPreferencesRef.current.fontSize);
  const [language, setLanguageState] = useState<Language>(initialPreferencesRef.current.language);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    normalizedInitialSettings?.resolvedTheme ?? getInitialResolvedTheme(initialPreferencesRef.current.theme),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastSyncedPreferencesRef = useRef(
    serializePreferences(
      normalizedInitialSettings
        ? {
            theme: normalizedInitialSettings.theme,
            fontSize: normalizedInitialSettings.fontSize,
            language: normalizedInitialSettings.language,
          }
        : getConfirmedStoredPreferencesSnapshot(),
    ),
  );
  const isReadyToPersistRef = useRef(false);

  const applyThemeRoleScope = useCallback((user: User | null | undefined) => {
    const root = document.documentElement;

    if (user?.role !== "admin" && user?.role !== "instructor" && user?.role !== "ta") {
      delete root.dataset.themeRole;
      return;
    }

    root.dataset.themeRole = "staff";
  }, []);

  const applyDisplayPreferences = useCallback((preferences: ReturnType<typeof normalizePreferences>, user: User | null | undefined) => {
    applyThemeRoleScope(user);
    setThemeState(preferences.theme);
    setFontSizeState(preferences.fontSize);
    setLanguageState(preferences.language);
    setSyncError(null);
  }, [applyThemeRoleScope]);

  const applyUserPreferences = useCallback((user: User | null | undefined) => {
    const nextPreferences = normalizePreferences(user?.preferences);
    applyDisplayPreferences(nextPreferences, user);
    lastSyncedPreferencesRef.current = serializePreferences(nextPreferences);
  }, [applyDisplayPreferences]);

  const applyCachedUserPreferences = useCallback((user: User | null | undefined) => {
    const nextPreferences = getCachedPreferencesSnapshot(user);
    applyDisplayPreferences(nextPreferences, user);
    lastSyncedPreferencesRef.current = serializePreferences(normalizePreferences(user?.preferences));
  }, [applyDisplayPreferences]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    authService.cachePendingPreferences({ theme: nextTheme });
  }, []);

  const setFontSize = useCallback((nextFontSize: FontSize) => {
    setFontSizeState(nextFontSize);
    authService.cachePendingPreferences({ fontSize: nextFontSize });
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    authService.cachePendingPreferences({ language: nextLanguage });
  }, []);

  const displayTheme = isStudentThemeLocked ? "light" : theme;
  const displayResolvedTheme = isStudentThemeLocked ? "light" : resolvedTheme;

  useEffect(() => {
    const storedUser = authService.getStoredUser();
    if (storedUser) {
      applyCachedUserPreferences(storedUser);
      setIsLoading(false);
    } else {
      applyThemeRoleScope(null);

      if (!authService.isAuthenticated()) {
        setIsLoading(false);
      }
    }
  }, [applyCachedUserPreferences, applyThemeRoleScope]);

  useEffect(() => {
    let isActive = true;

    const loadPreferences = async () => {
      if (!authService.isAuthenticated()) {
        applyUserPreferences(null);
        isReadyToPersistRef.current = true;
        setIsLoading(false);
        return;
      }

      try {
        const user = await authService.getCurrentUser();
        if (!isActive) {
          return;
        }

        applyCachedUserPreferences(user);
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("Failed to load user preferences:", error);
        setSyncError("ไม่สามารถโหลดการตั้งค่าผู้ใช้ได้");
      } finally {
        if (isActive) {
          isReadyToPersistRef.current = true;
          setIsLoading(false);
        }
      }
    };

    loadPreferences();

    return () => {
      isActive = false;
    };
  }, [applyCachedUserPreferences, applyUserPreferences]);

  useEffect(() => {
    const handleUserUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<User | null>;
      if (customEvent.detail === null) {
        applyUserPreferences(null);
      } else {
        applyCachedUserPreferences(customEvent.detail);
      }
      isReadyToPersistRef.current = true;
      setIsLoading(false);
    };

    window.addEventListener(AUTH_USER_UPDATED_EVENT, handleUserUpdated as EventListener);
    return () => {
      window.removeEventListener(AUTH_USER_UPDATED_EVENT, handleUserUpdated as EventListener);
    };
  }, [applyCachedUserPreferences, applyUserPreferences]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }

      if (
        event.key !== null &&
        event.key !== "user" &&
        event.key !== PENDING_PREFERENCES_STORAGE_KEY
      ) {
        return;
      }

      const storedUser = authService.getStoredUser();

      if (!storedUser) {
        applyUserPreferences(null);
      } else {
        applyCachedUserPreferences(storedUser);
      }

      isReadyToPersistRef.current = true;
      setIsLoading(false);
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [applyCachedUserPreferences, applyUserPreferences]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (isStudentThemeLocked) {
      setResolvedTheme("light");
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const syncResolvedTheme = () => {
      if (theme === "system") {
        setResolvedTheme(mediaQuery.matches ? "dark" : "light");
        return;
      }

      setResolvedTheme(theme);
    };

    syncResolvedTheme();
    mediaQuery.addEventListener("change", syncResolvedTheme);

    return () => mediaQuery.removeEventListener("change", syncResolvedTheme);
  }, [isStudentThemeLocked, theme]);

  useEffect(() => {
    const root = document.documentElement;
    const palette = ROOT_THEME_PALETTE[displayResolvedTheme];

    root.classList.toggle("dark", displayResolvedTheme === "dark");
    root.dataset.theme = displayResolvedTheme;
    root.style.colorScheme = displayResolvedTheme;
    root.style.backgroundColor = palette.background;
    root.style.color = palette.foreground;

    if (document.body) {
      document.body.style.backgroundColor = palette.background;
      document.body.style.color = palette.foreground;
    }
  }, [displayResolvedTheme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  useEffect(() => {
    persistAppearanceHintCookie({ theme: displayTheme, fontSize, language }, displayResolvedTheme);
  }, [displayResolvedTheme, displayTheme, fontSize, language]);

  useEffect(() => {
    if (!isReadyToPersistRef.current || !authService.isAuthenticated()) {
      return undefined;
    }

    const nextPreferences = { theme, fontSize, language };
    const serializedPreferences = serializePreferences(nextPreferences);
    if (serializedPreferences === lastSyncedPreferencesRef.current) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSaving(true);
      setSyncError(null);

      const result = await authService.updatePreferences(nextPreferences);

      if (result.success) {
        const confirmedPreferences = normalizePreferences(result.preferences ?? nextPreferences);
        lastSyncedPreferencesRef.current = serializePreferences(confirmedPreferences);
        setTheme(confirmedPreferences.theme);
        setFontSize(confirmedPreferences.fontSize);
        setLanguage(confirmedPreferences.language);
      } else {
        setSyncError(result.error || "บันทึกการตั้งค่าไม่สำเร็จ");
      }

      setIsSaving(false);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [fontSize, language, theme]);

  const value = useMemo(
    () => ({
      theme: displayTheme,
      resolvedTheme: displayResolvedTheme,
      isLoading,
      isSaving,
      syncError,
      setTheme: isStudentThemeLocked ? (() => {}) : setTheme,
      fontSize,
      setFontSize,
      language,
      setLanguage,
    }),
    [displayResolvedTheme, displayTheme, fontSize, isLoading, isSaving, isStudentThemeLocked, language, setTheme, syncError],
  );

  return (
    <GlobalSettingsContext.Provider value={value}>{children}</GlobalSettingsContext.Provider>
  );
};
