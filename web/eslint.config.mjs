// eslint.config.mjs — ɳTask web SaaS app (Vite + React 19)
// Flat config (ESLint v9+).
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // bff/server.cjs is a Node-core-only CommonJS adapter (no npm deps in its
    // runtime container) that dynamically `require()`s esbuild-bundled CJS
    // route handlers by resolved file path. Converting to ESM would replace
    // that with `import()`, whose CJS interop (default vs named exports via
    // cjs-module-lexer) is ambiguous for dynamically-resolved modules — the
    // plain `require()` behavior here is deliberate, not lint debt.
    files: ["bff/server.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: ["node_modules/", "dist/", ".next/", ".turbo/", "coverage/"],
  },
);
