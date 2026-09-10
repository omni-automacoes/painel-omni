/* =========================================================================
   OMNI DESIGN SYSTEM — preset de Tailwind
   Mapeia exatamente os mesmos tokens de css/omni-tokens.css.
   O arquivo CSS continua sendo a fonte da verdade: aqui só apontamos
   para as variáveis, então mudar o tema muda os dois lados de uma vez.

   Uso (tailwind.config.js):
     import omni from './tailwind/omni-preset.js'
     export default { presets: [omni], content: ['./src/**/*.{ts,tsx}'] }

   Importe css/omni-tokens.css no seu entrypoint de CSS, antes do Tailwind.
   ========================================================================= */

const v = (name) => `var(--omni-${name})`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* rampas de marca */
        indigo: {
          50: v("indigo-50"), 100: v("indigo-100"), 200: v("indigo-200"), 300: v("indigo-300"),
          400: v("indigo-400"), 500: v("indigo-500"), 600: v("indigo-600"), 700: v("indigo-700"),
          800: v("indigo-800"), 850: v("indigo-850"), 900: v("indigo-900"), 950: v("indigo-950"),
        },
        sky: {
          50: v("sky-50"), 100: v("sky-100"), 200: v("sky-200"), 300: v("sky-300"),
          400: v("sky-400"), 500: v("sky-500"), 600: v("sky-600"), 700: v("sky-700"),
          800: v("sky-800"), 900: v("sky-900"), 950: v("sky-950"),
        },
        amber: {
          50: v("amber-50"), 100: v("amber-100"), 200: v("amber-200"), 300: v("amber-300"),
          400: v("amber-400"), 500: v("amber-500"), 600: v("amber-600"), 700: v("amber-700"),
          800: v("amber-800"), 900: v("amber-900"), 950: v("amber-950"),
        },
        slate: {
          50: v("slate-50"), 100: v("slate-100"), 200: v("slate-200"), 300: v("slate-300"),
          400: v("slate-400"), 500: v("slate-500"), 600: v("slate-600"), 700: v("slate-700"),
          800: v("slate-800"), 850: v("slate-850"), 900: v("slate-900"), 950: v("slate-950"),
        },

        /* semânticos — use estes no dia a dia */
        bg: v("bg"),
        "bg-subtle": v("bg-subtle"),
        surface: { DEFAULT: v("surface"), 2: v("surface-2"), 3: v("surface-3"), inset: v("surface-inset") },
        line: { DEFAULT: v("border"), subtle: v("border-subtle"), strong: v("border-strong") },
        ink: { DEFAULT: v("text"), 2: v("text-2"), 3: v("text-3"), faint: v("text-faint"), inverse: v("text-inverse") },
        primary: {
          DEFAULT: v("primary"), hover: v("primary-hover"), active: v("primary-active"),
          fg: v("primary-fg"), soft: v("primary-soft"), "soft-fg": v("primary-soft-fg"),
        },
        accent: {
          DEFAULT: v("accent"), hover: v("accent-hover"), active: v("accent-active"),
          fg: v("accent-fg"), soft: v("accent-soft"), "soft-fg": v("accent-soft-fg"),
        },
        success: { DEFAULT: v("success"), soft: v("success-soft"), fg: v("success-fg") },
        warning: { DEFAULT: v("warning"), soft: v("warning-soft"), fg: v("warning-fg") },
        danger: { DEFAULT: v("danger"), hover: v("danger-hover"), soft: v("danger-soft"), fg: v("danger-fg") },
        info: { DEFAULT: v("info"), soft: v("info-soft"), fg: v("info-fg") },
        focus: v("focus"),

        /* séries de gráfico — sempre nesta ordem, nunca embaralhadas */
        chart: {
          1: v("chart-1"), 2: v("chart-2"), 3: v("chart-3"), 4: v("chart-4"),
          5: v("chart-5"), 6: v("chart-6"), 7: v("chart-7"),
          grid: v("chart-grid"), axis: v("chart-axis"), surface: v("chart-surface"),
        },
        seq: {
          1: v("seq-1"), 2: v("seq-2"), 3: v("seq-3"), 4: v("seq-4"),
          5: v("seq-5"), 6: v("seq-6"), 7: v("seq-7"),
        },
      },

      borderColor: { DEFAULT: v("border") },

      fontFamily: {
        sans: ['"Montserrat"', '"Segoe UI"', "system-ui", "-apple-system", "Arial", "sans-serif"],
        mono: ['"SFMono-Regular"', '"JetBrains Mono"', "Consolas", "monospace"],
      },

      fontSize: {
        "2xs": [v("text-2xs"), { lineHeight: "1.4" }],
        xs:    [v("text-xs"),  { lineHeight: "1.45" }],
        sm:    [v("text-sm"),  { lineHeight: "1.5" }],
        base:  [v("text-base"),{ lineHeight: "1.5" }],
        md:    [v("text-md"),  { lineHeight: "1.65" }],
        lg:    [v("text-lg"),  { lineHeight: "1.4" }],
        xl:    [v("text-xl"),  { lineHeight: "1.3" }],
        "2xl": [v("text-2xl"), { lineHeight: "1.2" }],
        "3xl": [v("text-3xl"), { lineHeight: "1.1" }],
        "4xl": [v("text-4xl"), { lineHeight: "1.08" }],
        "5xl": [v("text-5xl"), { lineHeight: "1.02" }],
      },

      letterSpacing: {
        tight: v("tracking-tight"),
        snug: v("tracking-snug"),
        wide: v("tracking-wide"),
        label: v("tracking-label"),
      },

      spacing: {
        1: v("space-1"), 2: v("space-2"), 3: v("space-3"), 4: v("space-4"),
        5: v("space-5"), 6: v("space-6"), 8: v("space-8"), 10: v("space-10"),
        12: v("space-12"), 16: v("space-16"), 20: v("space-20"), 24: v("space-24"),
      },

      borderRadius: {
        xs: v("radius-xs"), sm: v("radius-sm"), md: v("radius-md"),
        lg: v("radius-lg"), xl: v("radius-xl"), "2xl": v("radius-2xl"), full: v("radius-full"),
      },

      boxShadow: {
        xs: v("shadow-xs"), sm: v("shadow-sm"), md: v("shadow-md"), lg: v("shadow-lg"),
        focus: `0 0 0 3px ${v("primary-ring")}`,
      },

      height: { "control-sm": v("control-sm"), control: v("control-md"), "control-lg": v("control-lg"), row: v("row-height") },
      minHeight: { control: v("control-md") },
      width: { sidebar: v("sidebar-w") },
      maxWidth: { container: v("container"), prose: v("prose") },

      transitionTimingFunction: { omni: v("ease"), "omni-out": v("ease-out") },
      transitionDuration: { fast: v("dur-fast"), base: v("dur-base"), slow: v("dur-slow") },

      zIndex: {
        sticky: v("z-sticky"), dropdown: v("z-dropdown"), overlay: v("z-overlay"),
        modal: v("z-modal"), toast: v("z-toast"), tooltip: v("z-tooltip"),
      },
    },
  },
};
