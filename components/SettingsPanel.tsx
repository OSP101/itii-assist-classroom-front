"use client";

import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { DropdownItem } from "@heroui/dropdown";
import type { CollectionElement } from "@react-types/shared";
import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useI18n } from "@/hooks/useI18n";

type MenuSectionKey = "theme" | "language" | "fontSize";
type MenuFlyoutSide = "left" | "right";

interface SettingsPanelProps {
}

interface SettingsMenuItemsProps {
  menuFlyoutSide?: MenuFlyoutSide;
  onOptionSelect?: () => void;
}

const THEME_OPTIONS = ["system", "light", "dark"] as const;
const FONT_SIZE_OPTIONS = [
  { value: "sm", preview: "A-", labelKey: "small" },
  { value: "md", preview: "A", labelKey: "medium" },
  { value: "lg", preview: "A+", labelKey: "large" },
] as const;
const LANGUAGE_OPTIONS = [
  { value: "th", code: "TH", labelKey: "thai" },
  { value: "en", code: "EN", labelKey: "english" },
] as const;

function getFontSizeLabel(fontSize: "sm" | "md" | "lg", t: (key: string) => string) {
  switch (fontSize) {
    case "sm":
      return t("small");
    case "lg":
      return t("large");
    default:
      return t("medium");
  }
}

function getThemeLabel(
  theme: "system" | "light" | "dark",
  resolvedTheme: "light" | "dark",
  t: (key: string) => string,
) {
  return theme === "system" ? `${t("system")} (${t(resolvedTheme)})` : t(theme);
}

function getLanguageLabel(language: "th" | "en", t: (key: string) => string) {
  return language === "th" ? `${t("thai")} (TH)` : `${t("english")} (EN)`;
}

function buildPreferenceSections(
  theme: "system" | "light" | "dark",
  resolvedTheme: "light" | "dark",
  fontSize: "sm" | "md" | "lg",
  language: "th" | "en",
  setTheme: (value: "system" | "light" | "dark") => void,
  setFontSize: (value: "sm" | "md" | "lg") => void,
  setLanguage: (value: "th" | "en") => void,
  t: (key: string) => string,
) {
  return [
    {
      key: "theme" as const,
      icon: "solar:monitor-linear",
      label: t("appearance"),
      options: THEME_OPTIONS.map((value) => ({
        key: value,
        label: getThemeLabel(value, resolvedTheme, t),
        selected: theme === value,
        onSelect: () => setTheme(value),
      })),
    },
    {
      key: "language" as const,
      icon: "solar:earth-linear",
      label: t("language"),
      options: LANGUAGE_OPTIONS.map((option) => ({
        key: option.value,
        label: `${t(option.labelKey)} (${option.code})`,
        selected: language === option.value,
        onSelect: () => setLanguage(option.value),
      })),
    },
    {
      key: "fontSize" as const,
      icon: "solar:text-field-linear",
      label: t("fontSize"),
      options: FONT_SIZE_OPTIONS.map((option) => ({
        key: option.value,
        label: t(option.labelKey),
        preview: option.preview,
        selected: fontSize === option.value,
        onSelect: () => setFontSize(option.value),
      })),
    },
  ];
}

export const useSettingsMenuItems = ({
  menuFlyoutSide = "left",
  onOptionSelect,
}: SettingsMenuItemsProps): readonly [CollectionElement<object>, CollectionElement<object>, CollectionElement<object>] => {
  const {
    theme,
    resolvedTheme,
    isLoading,
    setTheme,
    fontSize,
    setFontSize,
    language,
    setLanguage,
  } = useGlobalSettings();
  const t = useI18n();
  const [openSection, setOpenSection] = useState<MenuSectionKey | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const flyoutClassName =
    menuFlyoutSide === "right"
      ? "absolute left-full top-0 z-30 ml-2 w-48 rounded-2xl border border-divider bg-content1 p-1 shadow-xl"
      : "absolute right-full top-0 z-30 mr-2 w-48 rounded-2xl border border-divider bg-content1 p-1 shadow-xl";
  const menuSections = buildPreferenceSections(
    theme,
    resolvedTheme,
    fontSize,
    language,
    setTheme,
    setFontSize,
    setLanguage,
    t,
  );

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openMenuSection = (sectionKey: MenuSectionKey) => {
    clearCloseTimer();
    setOpenSection(sectionKey);
  };

  const scheduleMenuClose = (sectionKey: MenuSectionKey) => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenSection((current) => (current === sectionKey ? null : current));
      closeTimerRef.current = null;
    }, 140);
  };

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, []);

  const renderMenuItem = (section: (typeof menuSections)[number]): CollectionElement<object> => (
    <DropdownItem
      key={`preference-${section.key}`}
      closeOnSelect={false}
      textValue={section.label}
      isDisabled={isLoading}
      startContent={
        <Icon
          icon={section.icon}
          className={clsx(
            "text-lg",
            openSection === section.key ? "text-default-700" : "text-default-500",
          )}
        />
      }
      endContent={<Icon icon="solar:alt-arrow-right-linear" className="text-sm text-default-400" />}
      className={clsx(
        "relative overflow-visible",
        openSection === section.key && "bg-default-100 text-foreground",
      )}
      onMouseEnter={() => {
        openMenuSection(section.key);
      }}
      onMouseLeave={() => {
        scheduleMenuClose(section.key);
      }}
      onFocus={() => {
        openMenuSection(section.key);
      }}
      onPress={() => {
        clearCloseTimer();
        setOpenSection((current) => (current === section.key ? null : section.key));
      }}
    >
      {section.label}
      {openSection === section.key ? (
        <div
          className={flyoutClassName}
          onMouseEnter={() => {
            openMenuSection(section.key);
          }}
          onMouseLeave={() => {
            scheduleMenuClose(section.key);
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="space-y-0.5">
            {section.options.map((option) => (
              (() => {
                const selectOption = (event?: React.PointerEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => {
                  event?.preventDefault();
                  event?.stopPropagation();
                  clearCloseTimer();
                  option.onSelect();
                  setOpenSection(null);
                  onOptionSelect?.();
                };

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={clsx(
                      "flex h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm leading-5 transition-colors",
                      option.selected
                        ? "font-medium text-foreground"
                        : "text-default-700 hover:bg-default-100",
                    )}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      selectOption(event);
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        selectOption(event);
                      }
                    }}
                  >
                    {"preview" in option ? (
                      <span className="w-7 shrink-0 text-center text-sm font-semibold text-current">
                        {option.preview}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.selected ? (
                      <Icon icon="solar:check-circle-bold" className="shrink-0 text-base text-default-700" />
                    ) : null}
                  </button>
                );
              })()
            ))}
          </div>
        </div>
      ) : null}
    </DropdownItem>
  );

  return [
    renderMenuItem(menuSections[0]),
    renderMenuItem(menuSections[1]),
    renderMenuItem(menuSections[2]),
  ] as const;
};

export const SettingsPanel: React.FC<SettingsPanelProps> = () => {
  const pathname = usePathname();
  const isStudentThemeLocked = pathname?.startsWith("/student") ?? false;
  const {
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
  } = useGlobalSettings();
  const t = useI18n();
  const currentThemeLabel = getThemeLabel(theme, resolvedTheme, t);
  const currentLanguageLabel = getLanguageLabel(language, t);
  const currentFontSizeLabel = getFontSizeLabel(fontSize, t);
  const containerClassName = "w-full max-w-xl rounded-3xl border border-divider bg-content1 p-5 shadow-sm";
  const sectionClassName = "rounded-2xl border border-divider bg-content2/80 p-4";
  const optionButtonClassName = (selected: boolean) =>
    clsx(
      "rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
      selected
        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
        : "border-default-200 bg-content1 text-default-700 hover:border-primary-300 hover:bg-primary-50/70 dark:hover:bg-primary/10",
    );

  return (
    <div className={containerClassName}>
      <div className="mb-4 space-y-1">
        <>
          <h2 className="text-base font-semibold text-foreground">
            {isStudentThemeLocked ? `${t("language")} / ${t("fontSize")}` : t("themeLanguageFontForThisAccount")}
          </h2>
          <p className="text-sm text-default-500">{t("savedToAccount")}</p>
        </>
      </div>

      <div className="space-y-3">
        {!isStudentThemeLocked ? (
          <section className={sectionClassName}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Icon icon="solar:settings-linear" className="text-lg" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("theme")}</p>
                  <p className="text-xs text-default-500">{currentThemeLabel}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={theme === value}
                  className={optionButtonClassName(theme === value)}
                  disabled={isLoading}
                  onClick={(event) => {
                    event.stopPropagation();
                    setTheme(value);
                  }}
                >
                  <span className="block text-sm font-semibold">{t(value)}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <Icon icon="solar:earth-linear" className="text-lg" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("language")}</p>
                <p className="text-xs text-default-500">{currentLanguageLabel}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={language === option.value}
                className={optionButtonClassName(language === option.value)}
                disabled={isLoading}
                onClick={(event) => {
                  event.stopPropagation();
                  setLanguage(option.value);
                }}
              >
                <span className="block text-sm font-semibold">{t(option.labelKey)}</span>
                <span className={clsx("mt-0.5 block text-[11px]", language === option.value ? "text-blue-100" : "text-default-400")}>
                  {option.code}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <span className="text-base font-semibold">A</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("fontSize")}</p>
                <p className="text-xs text-default-500">{currentFontSizeLabel}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {FONT_SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={fontSize === option.value}
                className={optionButtonClassName(fontSize === option.value)}
                disabled={isLoading}
                onClick={(event) => {
                  event.stopPropagation();
                  setFontSize(option.value);
                }}
              >
                <span className="block text-sm font-semibold">{option.preview}</span>
                <span className={clsx("mt-0.5 block text-[11px]", fontSize === option.value ? "text-blue-100" : "text-default-400")}>
                  {t(option.labelKey)}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-1 pt-1 text-xs">
        {isSaving ? <p className="text-primary-600">{t("saving")}</p> : null}
        {syncError ? <p className="text-rose-600">{syncError || t("saveError")}</p> : null}
      </div>
    </div>
  );
};
