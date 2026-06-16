import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1e3a5f",
          foreground: "#ffffff",
          50: "#eef2f7",
          100: "#d5dfe9",
          500: "#1e3a5f",
          600: "#162d4a",
          700: "#0f2035",
        },
        success: { DEFAULT: "#059669", foreground: "#ffffff" },
        warning: { DEFAULT: "#d97706", foreground: "#ffffff" },
        danger: { DEFAULT: "#dc2626", foreground: "#ffffff" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
