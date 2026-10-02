/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        void: "#05070d",
        panel: "rgba(9, 17, 31, 0.74)",
        cyanGlow: "#50e6ff",
        mintGlow: "#7dfacb",
        signal: "#dbeafe",
      },
      boxShadow: {
        glow: "0 0 40px rgba(80, 230, 255, 0.18)",
        panel: "0 18px 60px rgba(0, 0, 0, 0.34)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
