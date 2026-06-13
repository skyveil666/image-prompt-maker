/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0b0d12",
          panel: "#12151c",
          card: "#181c25",
          border: "#222734",
        },
        accent: {
          DEFAULT: "#7c5cff",
          hover: "#9079ff",
          soft: "#2a224a",
        },
        text: {
          base: "#eceef4",
          // コントラスト改善：以前の #8b91a3 より明るくし、薄い不透明度でも読めるように
          muted: "#a7adbe",
          // 説明文・補足テキスト用（muted より明るく、不透明度修飾子なしで使う）
          desc: "#b8bdd0",
        },
      },
      boxShadow: {
        card: "0 8px 24px rgba(0,0,0,0.35)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Noto Sans JP",
          "Hiragino Sans",
          "Yu Gothic",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
