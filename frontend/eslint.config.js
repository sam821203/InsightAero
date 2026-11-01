import { readdirSync } from "node:fs";
import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import css from "@eslint/css";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { importX } from "eslint-plugin-import-x";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import globals from "globals";
import insightaero from "./eslint-rules/index.js";

const features = readdirSync("./src/features", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const sharedFolders = [
  "api",
  "components",
  "config",
  "contexts",
  "hooks",
  "i18n",
  "lib",
  "locales",
  "stores",
  "styles",
  "types",
  "utils",
].map((folder) => `./src/${folder}`);

/* Code flows one way: shared → features → app (src/features/README.md). */
const importZones = [
  ...features.map((feature) => ({
    target: `./src/features/${feature}`,
    from: "./src/features",
    except: [`./${feature}`],
    message: "Features don't import each other; compose them in src/app instead.",
  })),
  {
    target: "./src/features",
    from: "./src/app",
    message: "Features never import from src/app.",
  },
  {
    target: sharedFolders,
    from: ["./src/features", "./src/app"],
    message: "Shared code never imports from features or app.",
  },
];

const hardCodedColor = "hard-coded color; use a semantic token (src/styles/tokens/README.md).";
const hexStart = "/^#[0-9a-fA-F]{3,8}\\b/";
const colorFunction = "/\\b(rgba?|hsla?)\\(\\s*\\d/";

export default defineConfig(
  { ignores: ["dist", "node_modules"] },

  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "import-x": importX,
      insightaero,
    },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver({ project: "./tsconfig.app.json" })],
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "import-x/no-restricted-paths": ["error", { zones: importZones }],
      "insightaero/no-primitive-tokens": "error",
      "insightaero/kebab-case-filenames": "error",
    },
  },

  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/tokens.ts"], // the CSS-to-JS bridge builds color strings from token values
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${hexStart}]`, message: hardCodedColor },
        { selector: `Literal[value=${colorFunction}]`, message: hardCodedColor },
        { selector: `TemplateElement[value.raw=${hexStart}]`, message: hardCodedColor },
        { selector: `TemplateElement[value.raw=${colorFunction}]`, message: hardCodedColor },
      ],
    },
  },

  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["*.config.ts"],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["src/**/*.css"],
    language: "css/css",
    languageOptions: { tolerant: true },
    plugins: { css, insightaero },
    rules: {
      "insightaero/kebab-case-filenames": "error",
      "insightaero/no-primitive-tokens": "error",
    },
  },
  {
    files: ["src/styles/tokens/*.css"],
    rules: { "insightaero/no-primitive-tokens": "off" },
  },
  {
    files: ["src/styles/tokens/semantic.css"],
    rules: { "insightaero/semantic-refs-exist": "error" },
  },
);
