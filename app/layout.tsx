import "./globals.css";
import { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import clsx from "clsx";
import { Providers } from "./providers";
import { siteConfig } from "../config/site";
import { fontSans } from "../config/fonts";
import {
  APPEARANCE_HINT_COOKIE_NAME,
  parseAppearanceHintCookieValue,
} from "@/lib/appearance-hint";

const SETTINGS_BOOTSTRAP_SCRIPT = `
(() => {
  const defaults = {
    theme: "system",
    fontSize: "md",
    language: "th",
  };
  const appearanceHintCookieName = "appearance-hint";
  const pendingPreferencesKey = "auth:pending-preferences";
  const bootstrapStyleId = "settings-bootstrap-surface";
  const palette = {
    light: {
      background: "#f4f7fb",
      foreground: "#0f172a",
    },
    dark: {
      background: "#0b1220",
      foreground: "#e7edf7",
    },
  };

  const normalizeTheme = (value) =>
    value === "light" || value === "dark" || value === "system" ? value : defaults.theme;
  const normalizeFontSize = (value) =>
    value === "sm" || value === "md" || value === "lg" ? value : defaults.fontSize;
  const normalizeLanguage = (value) =>
    value === "th" || value === "en" ? value : defaults.language;

  const getAppearanceHint = () => {
    const cookieEntry = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(appearanceHintCookieName + "="));

    if (!cookieEntry) {
      return null;
    }

    try {
      return JSON.parse(decodeURIComponent(cookieEntry.slice(appearanceHintCookieName.length + 1)));
    } catch {
      return null;
    }
  };

  let user = null;
  let pendingPreferences = null;
  const appearanceHint = getAppearanceHint();

  try {
    const rawUser = window.localStorage.getItem("user");
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    user = null;
  }

  try {
    const rawPendingPreferences = window.localStorage.getItem(pendingPreferencesKey);
    const pendingCache = rawPendingPreferences ? JSON.parse(rawPendingPreferences) : null;
    pendingPreferences =
      user && pendingCache && pendingCache.userId === user.id ? pendingCache.preferences ?? null : null;
  } catch {
    pendingPreferences = null;
  }

  const preferences = {
    ...(appearanceHint ?? {}),
    ...(user && user.preferences ? user.preferences : {}),
    ...(pendingPreferences ?? {}),
  };
  const theme = normalizeTheme(preferences.theme);
  const fontSize = normalizeFontSize(preferences.fontSize);
  const language = normalizeLanguage(preferences.language);
  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  const resolvedPalette = palette[resolvedTheme];

  const root = document.documentElement;
  const isStaffRole =
    user && (user.role === "admin" || user.role === "instructor" || user.role === "ta");

  let bootstrapStyle = document.getElementById(bootstrapStyleId);
  if (!bootstrapStyle) {
    bootstrapStyle = document.createElement("style");
    bootstrapStyle.id = bootstrapStyleId;
    document.head.appendChild(bootstrapStyle);
  }

  bootstrapStyle.textContent =
    "html{background-color:" + resolvedPalette.background + ";color:" + resolvedPalette.foreground + ";}" +
    "body{background-color:" + resolvedPalette.background + ";color:" + resolvedPalette.foreground + ";}";

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  root.lang = language;
  root.dataset.fontSize = fontSize;

  if (isStaffRole) {
    root.dataset.themeRole = "staff";
  } else {
    delete root.dataset.themeRole;
  }
})();
`;

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  applicationName: siteConfig.name,
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.organization.name }],
  creator: siteConfig.organization.name,
  publisher: siteConfig.organization.name,
  category: "education",
  referrer: "origin-when-cross-origin",
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    locale: "th_TH",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b7fff",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const appearanceHint = parseAppearanceHintCookieValue(
    cookieStore.get(APPEARANCE_HINT_COOKIE_NAME)?.value,
  );

  const initialResolvedTheme = appearanceHint?.resolvedTheme === "dark" ? "dark" : "light";
  const initialLanguage = appearanceHint?.language === "en" ? "en" : "th";
  const initialFontSize =
    appearanceHint?.fontSize === "sm" || appearanceHint?.fontSize === "lg"
      ? appearanceHint.fontSize
      : "md";
  const initialThemeRole = appearanceHint?.themeRole === "staff" ? "staff" : undefined;
  const initialTheme =
    appearanceHint?.theme === "light" || appearanceHint?.theme === "dark" || appearanceHint?.theme === "system"
      ? appearanceHint.theme
      : "system";

  return (
    <html
      suppressHydrationWarning
      lang={initialLanguage}
      className={initialResolvedTheme === "dark" ? "dark" : undefined}
      data-theme={initialResolvedTheme}
      data-theme-role={initialThemeRole}
      data-font-size={initialFontSize}
      style={{ colorScheme: initialResolvedTheme }}
    >
      <head>
        <script id="settings-bootstrap" dangerouslySetInnerHTML={{ __html: SETTINGS_BOOTSTRAP_SCRIPT }} />
      </head>
      <body
        className={clsx(
          "min-h-screen text-foreground bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        <Providers
          initialSettings={{
            theme: initialTheme,
            resolvedTheme: initialResolvedTheme,
            fontSize: initialFontSize,
            language: initialLanguage,
          }}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}