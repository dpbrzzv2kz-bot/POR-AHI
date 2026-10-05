// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**", "web-preview/**"],
  },
  {
    // Existing screen uses effect-driven request state and event-handler factories.
    // Keep compiler migration diagnostics visible while React Compiler is not enabled.
    files: ["App.tsx", "components/*.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  }
]);
