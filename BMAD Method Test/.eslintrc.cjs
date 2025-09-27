/* eslint config for TypeScript strict Node + React (web workspace) */
module.exports = {
  root: true,
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "coverage/",
    "web/dist/",
  ],
  env: {
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: false
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  rules: {
    "@typescript-eslint/consistent-type-imports": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": "off"
  },
  overrides: [
    {
      files: ["web/**/*.{ts,tsx}"],
      env: { browser: true, es2022: true },
      parserOptions: { ecmaFeatures: { jsx: true } },
      rules: {}
    },
    {
      files: ["tests/**/*.ts", "web/**/*.test.{ts,tsx}"],
      env: { node: true, jest: false }
    }
  ]
};
