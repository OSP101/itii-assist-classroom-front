/**
 * Design Tokens for ITII Assist Classroom
 * =========================================
 * สี, ขนาด, และ styling ที่ใช้ทั้งโปรเจค
 * อิงจากหน้า Login Page - โทนสีน้ำเงินพาสเทล
 */

export const designTokens = {
  // ===========================================
  // COLOR PALETTE
  // ===========================================
  colors: {
    // Primary Colors - น้ำเงินพาสเทล
    primary: {
      50: "#eff6ff",   // blue-50
      100: "#dbeafe",  // blue-100
      200: "#bfdbfe",  // blue-200
      300: "#93c5fd",  // blue-300
      400: "#60a5fa",  // blue-400 - Main Primary
      500: "#3b82f6",  // blue-500
      600: "#2563eb",  // blue-600
      700: "#1d4ed8",  // blue-700
      800: "#1e40af",  // blue-800
      900: "#1e3a8a",  // blue-900
      DEFAULT: "#60a5fa", // blue-400
    },

    // Secondary Colors - Indigo
    secondary: {
      50: "#eef2ff",   // indigo-50
      100: "#e0e7ff",  // indigo-100
      200: "#c7d2fe",  // indigo-200
      300: "#a5b4fc",  // indigo-300
      400: "#818cf8",  // indigo-400
      500: "#6366f1",  // indigo-500 - Main Secondary
      600: "#4f46e5",  // indigo-600
      700: "#4338ca",  // indigo-700
      800: "#3730a3",  // indigo-800
      900: "#312e81",  // indigo-900
      DEFAULT: "#6366f1", // indigo-500
    },

    // Accent Colors - Sky
    accent: {
      50: "#f0f9ff",   // sky-50
      100: "#e0f2fe",  // sky-100
      200: "#bae6fd",  // sky-200
      300: "#7dd3fc",  // sky-300
      400: "#38bdf8",  // sky-400
      500: "#0ea5e9",  // sky-500
      DEFAULT: "#0ea5e9", // sky-500
    },

    // Text Colors - Slate
    text: {
      primary: "#1e293b",   // slate-800
      secondary: "#475569", // slate-600
      muted: "#64748b",     // slate-500
      subtle: "#94a3b8",    // slate-400
      inverse: "#ffffff",   // white
    },

    // Background Colors
    background: {
      primary: "#ffffff",           // white
      secondary: "#f8fafc",         // slate-50
      tertiary: "#f1f5f9",          // slate-100
      gradient: {
        from: "#eff6ff",            // blue-50
        via: "#f0f9ff",             // sky-50
        to: "#e0e7ff",              // indigo-100
      },
    },

    // Border Colors
    border: {
      light: "#dbeafe",    // blue-100
      default: "#bfdbfe",  // blue-200
      focus: "#60a5fa",    // blue-400
    },

    // Status Colors
    status: {
      success: {
        light: "#dcfce7",  // green-100
        default: "#22c55e", // green-500
        dark: "#15803d",   // green-700
      },
      warning: {
        light: "#fef3c7",  // amber-100
        default: "#f59e0b", // amber-500
        dark: "#b45309",   // amber-700
      },
      error: {
        light: "#fee2e2",  // red-100
        default: "#ef4444", // red-500
        dark: "#b91c1c",   // red-700
      },
      info: {
        light: "#dbeafe",  // blue-100
        default: "#3b82f6", // blue-500
        dark: "#1d4ed8",   // blue-700
      },
    },
  },

  // ===========================================
  // TYPOGRAPHY
  // ===========================================
  typography: {
    fontFamily: {
      sans: "Kanit, sans-serif",
      mono: "Fira Code, monospace",
    },
    fontSize: {
      xs: "0.75rem",     // 12px
      sm: "0.875rem",    // 14px
      base: "1rem",      // 16px
      lg: "1.125rem",    // 18px
      xl: "1.25rem",     // 20px
      "2xl": "1.5rem",   // 24px
      "3xl": "1.875rem", // 30px
      "4xl": "2.25rem",  // 36px
      "5xl": "3rem",     // 48px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  // ===========================================
  // SPACING
  // ===========================================
  spacing: {
    xs: "0.25rem",   // 4px
    sm: "0.5rem",    // 8px
    md: "1rem",      // 16px
    lg: "1.5rem",    // 24px
    xl: "2rem",      // 32px
    "2xl": "3rem",   // 48px
    "3xl": "4rem",   // 64px
  },

  // ===========================================
  // BORDER RADIUS
  // ===========================================
  borderRadius: {
    none: "0",
    sm: "0.25rem",   // 4px
    md: "0.5rem",    // 8px
    lg: "0.75rem",   // 12px
    xl: "1rem",      // 16px
    "2xl": "1.5rem", // 24px
    full: "9999px",
  },

  // ===========================================
  // SHADOWS
  // ===========================================
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    // Primary color shadows
    primary: "0 10px 15px -3px rgb(96 165 250 / 0.3)",
    "primary-lg": "0 20px 25px -5px rgb(96 165 250 / 0.4)",
  },

  // ===========================================
  // TRANSITIONS
  // ===========================================
  transitions: {
    fast: "150ms ease-in-out",
    normal: "200ms ease-in-out",
    slow: "300ms ease-in-out",
  },

  // ===========================================
  // Z-INDEX
  // ===========================================
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    toast: 1080,
  },

  // ===========================================
  // BREAKPOINTS
  // ===========================================
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
};

// CSS Variables for use in components
export const cssVariables = `
  :root {
    /* Primary Colors */
    --color-primary-50: ${designTokens.colors.primary[50]};
    --color-primary-100: ${designTokens.colors.primary[100]};
    --color-primary-200: ${designTokens.colors.primary[200]};
    --color-primary-300: ${designTokens.colors.primary[300]};
    --color-primary-400: ${designTokens.colors.primary[400]};
    --color-primary-500: ${designTokens.colors.primary[500]};
    --color-primary: ${designTokens.colors.primary.DEFAULT};

    /* Secondary Colors */
    --color-secondary-400: ${designTokens.colors.secondary[400]};
    --color-secondary-500: ${designTokens.colors.secondary[500]};
    --color-secondary: ${designTokens.colors.secondary.DEFAULT};

    /* Text Colors */
    --color-text-primary: ${designTokens.colors.text.primary};
    --color-text-secondary: ${designTokens.colors.text.secondary};
    --color-text-muted: ${designTokens.colors.text.muted};
    --color-text-subtle: ${designTokens.colors.text.subtle};

    /* Border Colors */
    --color-border-light: ${designTokens.colors.border.light};
    --color-border: ${designTokens.colors.border.default};
    --color-border-focus: ${designTokens.colors.border.focus};

    /* Shadows */
    --shadow-primary: ${designTokens.shadows.primary};
    --shadow-primary-lg: ${designTokens.shadows["primary-lg"]};
  }
`;

export default designTokens;
