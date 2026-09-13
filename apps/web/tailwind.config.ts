import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0b0907",
          secondary: "#100d0a",
          card: "#17130f",
        },
        border: "rgba(255,255,255,0.08)",
        // Kept under the `accent` key so existing `accent-*` utilities resolve;
        // the values are the tangerine palette.
        accent: {
          purple: "#f97316",
          teal: "#fdba74",
          DEFAULT: "#f97316",
          soft: "#fdba74",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        sans: ["Instrument Sans", "system-ui", "sans-serif"],
        mono: ["Martian Mono", "ui-monospace", "monospace"],
        code: ["Geist Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        purple: "0 14px 34px -14px rgba(249,115,22,0.20)",
        teal: "0 14px 34px -14px rgba(253,186,116,0.20)",
        glow: "0 14px 34px -14px rgba(249,115,22,0.20)",
        feature: "0 30px 80px -40px rgba(249,115,22,0.20)",
        terminal: "0 40px 80px -40px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
