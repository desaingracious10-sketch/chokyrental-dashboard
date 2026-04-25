/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0d1f4e",
        teal: "#00b8a9",
        "teal-dark": "#009e91",
      },
    },
  },
  plugins: [],
};
