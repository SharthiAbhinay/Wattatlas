import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import prettier from "eslint-plugin-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  { ignores: ["**/node_modules/", "frontend/dist/"] },
  js.configs.recommended,
  {
    // Server code and config files run in Node.
    files: ["server/**/*.js", "*.js", "frontend/vite.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // Express error handlers need all four arguments, even unused ones.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // The React app runs in the browser. The React plugin lets ESLint see
    // components used in JSX, so their imports don't look unused.
    files: ["frontend/src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "18.3" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Runs Prettier through ESLint. Prettier's settings live only in the
    // "prettier" section of package.json, so npm run format and npm run lint
    // always agree.
    plugins: { prettier },
    rules: { "prettier/prettier": "error" },
  },
  eslintConfigPrettier,
];
