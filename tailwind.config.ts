import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ritual: {
          page: "#F5F0E8",
          card: "#FBF7EF",
          cardAlt: "#EFE7DA",
          green: "#2F795A",
          text: "#000000",
        },
      },
      boxShadow: {
        soft: "0 16px 50px rgba(47, 121, 90, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
