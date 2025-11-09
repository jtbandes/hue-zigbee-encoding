import foxglove from "@foxglove/eslint-plugin";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: ["dist"],
  },
  {
    languageOptions: {
      parserOptions: {
        project: "tsconfig.eslint.json",
      },
    },
  },
  foxglove.configs.base,
  foxglove.configs.typescript,
  {
    rules: {
      "no-loop-func": "error",

      // non-literal members are useful for bit flags
      "@typescript-eslint/prefer-literal-enum-member": "off",

      "@typescript-eslint/explicit-member-accessibility": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
    },
  },
);
