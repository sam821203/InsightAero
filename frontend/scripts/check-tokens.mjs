#!/usr/bin/env node
/**
 * Guards the three-tier token architecture (src/styles/tokens/README.md).
 *
 *   1. No hard-coded colors (hex, rgb(), hsl() literals) in TS/TSX.
 *   2. Only semantic.css may reference primitive tokens.
 *   3. semantic.css may only reference primitives; components.css may only
 *      reference semantic tokens.
 *
 * Run: npm run lint:tokens
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const TOKENS = join(SRC, "styles/tokens");

/* Google Maps base map styles still use hex; moved to tokens in the map-style PR. */
const HEX_ALLOWLIST = new Set(["src/components/GoogleMapView.tsx", "src/hooks/useDroneMap.ts"]);
/* The CSS-to-JS bridge itself builds color strings from token values. */
HEX_ALLOWLIST.add("src/lib/tokens.ts");

const primitiveNames = new Set(
  [...readFileSync(join(TOKENS, "primitives.css"), "utf8").matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1])
);
const semanticNames = new Set(
  [...readFileSync(join(TOKENS, "semantic.css"), "utf8").matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1])
);

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

const varRefs = (text) => [...text.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]);

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (/\.(ts|tsx)$/.test(file)) {
    eachLine(file, (text, line) => {
      if (!HEX_ALLOWLIST.has(rel) && /["'`]#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(\s*\d/.test(text)) {
        report(file, line, "hard-coded color; use a semantic or component token");
      }
      for (const name of varRefs(text)) {
        if (primitiveNames.has(name)) report(file, line, `primitive token --${name} used outside semantic.css`);
      }
    });
  }
}

eachLine(join(TOKENS, "semantic.css"), (text, line) => {
  for (const name of varRefs(text)) {
    if (!primitiveNames.has(name) && !semanticNames.has(name)) {
      report(join(TOKENS, "semantic.css"), line, `--${name} is not a primitive`);
    }
  }
});

eachLine(join(TOKENS, "components.css"), (text, line) => {
  for (const name of varRefs(text)) {
    if (primitiveNames.has(name)) report(join(TOKENS, "components.css"), line, `component token reads primitive --${name}`);
  }
});

for (const file of [join(SRC, "index.css"), join(ROOT, "tailwind.config.ts")]) {
  eachLine(file, (text, line) => {
    for (const name of [...varRefs(text), ...[...text.matchAll(/token\("([a-z0-9-]+)"\)/g)].map((m) => m[1])]) {
      if (primitiveNames.has(name)) report(file, line, `primitive token --${name}; reference a semantic token instead`);
    }
  });
}

if (errors.length > 0) {
  console.error(`Token check failed (${errors.length}):\n` + errors.map((e) => `  ${e}`).join("\n"));
  process.exit(1);
}
console.log("Token check passed.");
