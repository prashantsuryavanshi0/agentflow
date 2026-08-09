import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E1015",
        surface: "#12151C",
        raised: "#181C26",
        line: "#242938",
        muted: "#8890A4",
        fg: "#E9EBF2",
        signal: "#5EEAD4",
        warn: "#F5A623",
        good: "#34D399",
        bad: "#F87171",
        role: "#8B87F7",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        pulseTrace: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        flow: {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
        ringPulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(245,166,35,0.45)" },
          "70%": { boxShadow: "0 0 0 10px rgba(245,166,35,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(245,166,35,0)" },
        },
      },
      animation: {
        pulseTrace: "pulseTrace 1.4s ease-in-out infinite",
        flow: "flow 0.6s linear infinite",
        ringPulse: "ringPulse 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
