import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/**
 * Design tokens da loja.
 * Paleta sóbria: neutros "stone", preto profundo (ink) e UM acento verde esmeralda.
 * Fontes vêm das variáveis CSS definidas com next/font em src/app/layout.tsx.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#131316", // Texto/botões principais — preto profundo
        },
        accent: {
          50: "#ecf6f4",
          100: "#d5eae7",
          200: "#a9d5cf",
          300: "#7abcb2",
          400: "#4a9d90",
          500: "#287f70",
          600: "#0e6b5f", // Cor de destaque (CTAs, selos, links)
          700: "#0b574e",
          800: "#094540",
          900: "#072f2c",
          950: "#041e1c",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(19,19,22,0.05), 0 10px 30px -14px rgba(19,19,22,0.16)",
        drawer: "-16px 0 40px -12px rgba(19,19,22,0.25)",
      },
      keyframes: {
        // Entrada do drawer/modal (animação só de entrada, sem complexidade de saída)
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "slide-in-left": "slide-in-left 0.3s cubic-bezier(0.32,0.72,0,1)",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.32,0.72,0,1)",
        "fade-in": "fade-in 0.2s ease-out",
        marquee: "marquee 36s linear infinite",
      },
    },
  },
  plugins: [typography],
};

export default config;
