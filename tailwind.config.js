/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        "input-bg": "var(--input-bg)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Warm shadows using brownish-grey tones
        "warm-sm": "0 1px 2px 0 rgba(43, 39, 38, 0.05), 0 1px 3px 0 rgba(43, 39, 38, 0.06)",
        "warm-md": "0 4px 6px -1px rgba(43, 39, 38, 0.06), 0 2px 4px -2px rgba(43, 39, 38, 0.08)",
        "warm-lg": "0 10px 15px -3px rgba(43, 39, 38, 0.08), 0 4px 6px -4px rgba(43, 39, 38, 0.08)",
        "warm-xl": "0 20px 25px -5px rgba(43, 39, 38, 0.08), 0 8px 10px -6px rgba(43, 39, 38, 0.08)",
        // Normal warm shadow for logo/icons
        "warm-icon": "0 4px 12px -2px rgba(43, 39, 38, 0.12), 0 2px 6px -2px rgba(43, 39, 38, 0.08)",
        // Primary color glow for dark mode
        "primary-glow": "0 4px 14px 0 rgba(172, 15, 22, 0.35)",
        "primary-glow-lg": "0 6px 20px 0 rgba(172, 15, 22, 0.45)",
        // Accent color glow for focus states
        "accent-glow": "0 0 0 3px rgba(46, 175, 197, 0.35)",
        // Card elevation
        "card": "0 2px 8px -2px rgba(43, 39, 38, 0.06), 0 4px 12px -4px rgba(43, 39, 38, 0.05)",
        "card-hover": "0 8px 24px -4px rgba(43, 39, 38, 0.1), 0 6px 16px -6px rgba(43, 39, 38, 0.08)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Subtle pulse for notifications/badges
        "pulse-warm": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        // Slide in from right for dialogs
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        // Loading animation for progress bars
        "loading": {
          from: { width: "0%" },
          to: { width: "100%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-warm": "pulse-warm 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "loading": "loading 2s ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
