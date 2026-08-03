import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "CallExpression[callee.property.name='slice'] > MemberExpression[property.name='slice'] > CallExpression[callee.property.name='toISOString']",
          message:
            "Don't derive a YYYY-MM-DD date key from toISOString() — it shifts to UTC and returns yesterday for US timezones. Use todayISO() / localDateISO() from @/lib/pm/format.",
        },
        {
          selector:
            "MemberExpression[property.name='split'] > CallExpression[callee.property.name='toISOString']",
          message:
            "Don't derive a YYYY-MM-DD date key from toISOString() — it shifts to UTC and returns yesterday for US timezones. Use todayISO() / localDateISO() from @/lib/pm/format.",
        },
      ],
    },
  },
);
