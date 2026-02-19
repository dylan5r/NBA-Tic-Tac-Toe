import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Oswald", "sans-serif"],
        body: ["Manrope", "sans-serif"],
        score: ["Orbitron", "monospace"]
      },
      colors: {
        arena: {
          base: "#0e0e10",
          panel: "#181a20",
          line: "#2c3446",
          text: "#edf1f8",
          muted: "#9aa6bc",
          orange: "#ff6a2a",
          blue: "#37a4ff",
          red: "#ff3e49"
        }
      },
      boxShadow: {
        panel: "0 18px 48px rgba(0,0,0,0.45)",
        glowOrange: "0 0 0 1px rgba(255,106,42,0.45), 0 0 22px rgba(255,106,42,0.25)",
        glowBlue: "0 0 0 1px rgba(55,164,255,0.45), 0 0 22px rgba(55,164,255,0.25)",
        led: "0 0 0 1px rgba(255,62,73,0.65), 0 0 20px rgba(255,62,73,0.35)"
      },
      animation: {
        "fade-up": "fadeUp 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "line-pop": "linePop 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "slow-pan": "slowPan 9s ease-in-out infinite alternate",
        "pulse-led": "pulseLed 1.1s ease-in-out infinite",
        "draw-line": "drawLine 420ms cubic-bezier(0.2, 0.8, 0.2, 1)"
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        linePop: {
          from: { opacity: "0", transform: "scaleX(0.6)" },
          to: { opacity: "1", transform: "scaleX(1)" }
        },
        slowPan: {
          from: { transform: "translate3d(0,0,0)" },
          to: { transform: "translate3d(0,-12px,0)" }
        },
        pulseLed: {
          "0%,100%": { boxShadow: "0 0 0 1px rgba(255,62,73,0.55), 0 0 14px rgba(255,62,73,0.35)" },
          "50%": { boxShadow: "0 0 0 1px rgba(255,62,73,0.95), 0 0 24px rgba(255,62,73,0.55)" }
        },
        drawLine: {
          from: { transform: "scaleX(0)", opacity: "0.45" },
          to: { transform: "scaleX(1)", opacity: "1" }
        }
      }
    }
  },
  plugins: []
};

export default config;
