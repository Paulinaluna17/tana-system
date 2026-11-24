import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./emails/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        ink: v("ink"),
        muted: v("muted"),
        line: v("line"),
        accent: v("accent"),
        "accent-ink": v("accent-ink"),
        ok: v("ok"),
        warn: v("warn"),
        danger: v("danger"),
        info: v("info"),
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-heading)", "var(--font-body)", "serif"],
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem" },
    },
  },
  plugins: [animate],
};

export default config;
