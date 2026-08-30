import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ]
    }
  },
  {
    // React hook rules, scoped to the files that have hooks in them.
    //
    // exhaustive-deps is an error rather than a warning because this codebase
    // has shipped the same bug three separate times: a value that changes
    // identity every render sitting in a dependency array, causing a WebSocket
    // to reconnect in a loop, a guest identity to be minted repeatedly, and a
    // room to connect twice per page load. The rule catches exactly that.
    files: ["apps/web/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/.wrangler/**",
      "**/coverage/**"
    ]
  }
);
