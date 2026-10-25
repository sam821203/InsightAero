#!/usr/bin/env node
/**
 * Guards the two-layer token setup (src/styles/tokens/README.md).
 *
 *   1. No hard-coded colors (hex, rgb(), hsl() literals) in TS/TSX.
 *   2. Only semantic.css may reference primitive tokens.
 *   3. semantic.css may only reference primitives (or other semantic tokens).
 *
 * Run: npm run lint:tokens
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const TOKENS = join(SRC, "styles/tokens");

const HEX_ALLOWLIST = new Set([
  /* The CSS-to-JS bridge itself builds color strings from token values. */
  "src/lib/tokens.ts",
]);

const namesIn = (file) =>
  new Set([...readFileSync(file, "utf8").matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]));
const primitiveNames = namesIn(join(TOKENS, "primitives.css"));
const semanticNames = namesIn(join(TOKENS, "semantic.css"));

const errors = [];
const report = (file, line, message) => errors.push(`${relative(ROOT, file)}:${line}  ${message}`);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function eachLine(file, fn) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((text, i) => fn(text, i + 1));
}

/* var(--x), token("x") in tailwind.config.ts, readColorToken("x") in TS */
const tokenRefs = (text) =>
  [...text.matchAll(/var\(--([a-z0-9-]+)\)|(?:token|read(?:Color|Hex)Token)\("([a-z0-9-]+)"/g)].map(
    (m) => m[1] ?? m[2]
  );

const consumers = [
  join(SRC, "index.css"),
  join(ROOT, "tailwind.config.ts"),
  ...walk(SRC).filter((file) => /\.(ts|tsx)$/.test(file)),
];

for (const file of consumers) {
  const rel = relative(ROOT, file);
  eachLine(file, (text, line) => {
    if (/\.(ts|tsx)$/.test(file) && !HEX_ALLOWLIST.has(rel) && /["'`]#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(\s*\d/.test(text)) {
      report(file, line, "hard-coded color; use a semantic token");
    }
    for (const name of tokenRefs(text)) {
      if (primitiveNames.has(name)) report(file, line, `primitive token --${name}; use a semantic token`);
    }
  });
}

eachLine(join(TOKENS, "semantic.css"), (text, line) => {
  for (const name of tokenRefs(text)) {
    if (!primitiveNames.has(name) && !semanticNames.has(name)) {
      report(join(TOKENS, "semantic.css"), line, `--${name} is not defined in primitives.css`);
    }
  }
});

if (errors.length > 0) {
  console.error(`Token check failed (${errors.length}):\n` + errors.map((e) => `  ${e}`).join("\n"));
  process.exit(1);
}
console.log("Token check passed.");
