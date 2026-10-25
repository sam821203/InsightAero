#!/usr/bin/env node
/**
 * Keeps file and folder names under src/ in kebab-case, as in bulletproof-react
 * (see src/features/README.md). Dots separate kebab-case parts: `fleet.api.hook.ts`.
 *
 * Run: npm run lint:filenames
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/* Names that follow another convention on purpose. */
const ALLOWED = new Set([
  "README.md",
  "zh-TW.ts", // BCP 47 language tag, matches the i18next language code
]);

const errors = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!ALLOWED.has(name) && !KEBAB.test(name)) {
      errors.push(`${relative(ROOT, path)}  should be kebab-case`);
    }
    if (statSync(path).isDirectory()) walk(path);
  }
}

walk(SRC);

if (errors.length > 0) {
  console.error(`File name check failed (${errors.length}):\n` + errors.map((e) => `  ${e}`).join("\n"));
  process.exit(1);
}
console.log("File name check passed.");
