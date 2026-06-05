import type { Config } from "tailwindcss";

const config: Config = {

  content: [

    "./pages/**/*.{js,ts,jsx,tsx,mdx}",

    "./components/**/*.{js,ts,jsx,tsx,mdx}",

    "./app/**/*.{js,ts,jsx,tsx,mdx}",

  ],

  theme: {

    extend: {

      colors: {

        primary: "#FF5A1F",

        secondary: "#0F172A",

        accent: "#FACC15",

        success: "#22C55E",

        background: "#F9FAFB",

      },

    },

  },

  plugins: [],

};

export default config;