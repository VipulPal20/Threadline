import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172019",
        muted: "#6d796e",
        paper: "#f7f6f0",
        line: "#dfe5dc",
        lime: { DEFAULT: "#b8d830", dark: "#6b8f1d", soft: "#eef5cd" },
        sun: { DEFAULT: "#f07d35", soft: "#fff0e9", dark: "#a44316" },
        sky: { soft: "#cfe4e7", dark: "#3a5b61" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0) rotate(var(--r,0deg))" }, "50%": { transform: "translateY(-12px) rotate(var(--r,0deg))" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        wiggle: { "0%,100%": { transform: "rotate(-4deg)" }, "50%": { transform: "rotate(4deg)" } },
        rise: { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pop: { "0%": { transform: "scale(.8)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        marquee: "marquee 30s linear infinite",
        wiggle: "wiggle 1.2s ease-in-out infinite",
        rise: "rise .5s cubic-bezier(.22,1,.36,1) both",
        pop: "pop .35s cubic-bezier(.34,1.56,.64,1) both",
      },
      boxShadow: {
        card: "0 5px 18px rgba(27,39,25,.04)",
        lift: "0 18px 45px rgba(27,39,25,.08)",
      },
    },
  },
  plugins: [],
};

export default config;
