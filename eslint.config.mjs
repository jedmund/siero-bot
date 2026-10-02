import globals from "globals"
import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["build/**", "node_modules/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    files: [
      "src/commands/raid.ts",
      "src/services/gacha.ts",
      "src/utils/rendering.ts",
    ],
    rules: { "no-useless-assignment": "off" },
  },
  // Existing lifecycle defects belong to PRDs 05, 06, 08, and 09.
  // Remove each exception as that file's promise handling is repaired.
  {
    files: [
      "src/commands/raid.ts",
      "src/commands/rateup.ts",
      "src/index.ts",
      "src/scripts/purge-commands.ts",
      "src/services/cache.ts",
      "src/services/rateup.ts",
      "src/services/until.ts",
    ],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
  },
)
