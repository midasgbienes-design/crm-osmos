import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        osmos: {
          navy: "#00246A",
          navy2: "#0C3585",
          teal: "#0093A5",
          tealdark: "#005A66",
          yellow: "#D3D200",
          ink: "#1B2A4A",
          muted: "#4A5A7E",
          line: "#DDE3EE",
          soft: "#EDF0F5",
          bg: "#F3F5F9",
          hover: "#E6EEF9",
        },
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
        display: ["Michroma", "Barlow", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
