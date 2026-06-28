"use client";

import React from "react";
import { SettingsPanel } from "@/components/SettingsPanel";
import { PwaPreferencesPanel } from "@/components/system/PwaPreferencesPanel";
import { useI18n } from "@/hooks/useI18n";

export default function SettingsPage() {
  const t = useI18n();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t("appearanceAndLanguage")}</h1>
          <p className="mt-2 text-sm text-default-500">{t("settingsDescription")}</p>
        </div>
        <div className="space-y-4">
          <SettingsPanel />
          <PwaPreferencesPanel />
        </div>
      </div>
    </main>
  );
}
