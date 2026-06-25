import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3f4f6",
        ink: "#1f2937"
      },
      boxShadow: {
        panel: "0 1px 0 rgba(0,0,0,0.03), 0 2px 14px rgba(0,0,0,0.04)"
      }
    }
  },
  plugins: []
};

export default config;
