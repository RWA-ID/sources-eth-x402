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
          primary: "#0a0a0f",
          secondary: "#111118",
          card: "#16161f",
        },
        border: "rgba(255,255,255,0.07)",
        accent: {
          purple: "#7c6aff",
          teal: "#4fd8b8",
        },
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        purple: "0 0 20px rgba(124, 106, 255, 0.25)",
        teal: "0 0 20px rgba(79, 216, 184, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
