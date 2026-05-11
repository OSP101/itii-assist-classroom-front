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
import {
  authService,
  AUTH_USER_UPDATED_EVENT,
  type User,
  type UserPreferences,
} from "@/services/auth.service";
import {
  buildAppearanceHintCookieString,
  clearAppearanceHintCookieString,
} from "@/lib/appearance-hint";

export type Language = "th" | "en";
export type FontSize = "sm" | "md" | "lg";
export type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const DEFAULT_SETTINGS = {
  theme: "system" as ThemePreference,
  fontSize: "md" as FontSize,
  language: "th" as Language,
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
  return normalizePreferences(storedUser?.preferences);
}

function getCachedPreferencesSnapshot(user?: User | null) {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  const storedUser = user ?? authService.getStoredUser();
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
  if (!storedUser) {
    document.cookie = clearAppearanceHintCookieString();
    return;
  }

  const isStaffRole =
    storedUser.role === "admin" || storedUser.role === "instructor" || storedUser.role === "ta";

  document.cookie = buildAppearanceHintCookieString({
    theme: preferences.theme,
    resolvedTheme,
    fontSize: preferences.fontSize,
    language: preferences.language,
    themeRole: isStaffRole ? "staff" : undefined,
  });
}

export const GlobalSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialPreferencesRef = useRef(getCachedPreferencesSnapshot());
  const [theme, setThemeState] = useState<ThemePreference>(initialPreferencesRef.current.theme);
  const [fontSize, setFontSizeState] = useState<FontSize>(initialPreferencesRef.current.fontSize);
  const [language, setLanguageState] = useState<Language>(initialPreferencesRef.current.language);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    getInitialResolvedTheme(initialPreferencesRef.current.theme),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastSyncedPreferencesRef = useRef(serializePreferences(getConfirmedStoredPreferencesSnapshot()));
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

  useEffect(() => {
    const storedUser = authService.getStoredUser();
    if (storedUser) {
      applyCachedUserPreferences(storedUser);
      setIsLoading(false);
    } else {
      applyThemeRoleScope(null);
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
    if (typeof window === "undefined") {
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
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  useEffect(() => {
    persistAppearanceHintCookie({ theme, fontSize, language }, resolvedTheme);
  }, [fontSize, language, resolvedTheme, theme]);

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
      theme,
      resolvedTheme,
      isLoading,
      isSaving,
      syncError,
      setTheme,
      fontSize,
      setFontSize,
      language,
      setLanguage,
    }),
    [fontSize, isLoading, isSaving, language, resolvedTheme, syncError, theme],
  );

  return (
    <GlobalSettingsContext.Provider value={value}>{children}</GlobalSettingsContext.Provider>
  );
};
