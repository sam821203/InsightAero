/**
 * Project rules that no published plugin covers. They run on TS/TSX and, through
 * @eslint/css, on CSS. See src/styles/tokens/README.md and src/features/README.md.
 */
import { readFileSync } from "node:fs";
import { basename, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TOKENS = `${ROOT}src/styles/tokens`;

const namesIn = (file) =>
  new Set([...readFileSync(file, "utf8").matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]));

let tokenNames;
function tokens() {
  tokenNames ??= {
    primitive: namesIn(`${TOKENS}/primitives.css`),
    semantic: namesIn(`${TOKENS}/semantic.css`),
  };
  return tokenNames;
}

const TOKEN_HELPERS = new Set(["token", "readColorToken", "readHexToken"]);

/* Blank out CSS comments but keep offsets, so locations stay right. */
const cssWithoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

function cssVarRefs(sourceCode, onRef) {
  const text = cssWithoutComments(sourceCode.text);
  for (const m of text.matchAll(/var\(\s*--([a-z0-9-]+)/g)) {
    const start = sourceCode.getLocFromIndex(m.index);
    const end = sourceCode.getLocFromIndex(m.index + m[0].length);
    onRef(m[1], { start, end });
  }
}

const noPrimitiveTokens = {
  meta: {
    type: "problem",
    docs: { description: "Only semantic.css may reference primitive tokens" },
    messages: { primitive: "Primitive token --{{name}}; use a semantic token." },
    schema: [],
  },
  create(context) {
    const { primitive } = tokens();
    const check = (name, loc) => {
      if (primitive.has(name)) context.report({ loc, messageId: "primitive", data: { name } });
    };
    const checkString = (node, text) => {
      for (const m of text.matchAll(/var\(\s*--([a-z0-9-]+)/g)) check(m[1], node.loc);
    };
    return {
      StyleSheet() {
        cssVarRefs(context.sourceCode, check);
      },
      Literal(node) {
        if (typeof node.value === "string") checkString(node, node.value);
      },
      TemplateElement(node) {
        checkString(node, node.value.raw);
      },
      CallExpression(node) {
        const [arg] = node.arguments;
        if (
          node.callee.type === "Identifier" &&
          TOKEN_HELPERS.has(node.callee.name) &&
          arg?.type === "Literal" &&
          typeof arg.value === "string"
        ) {
          check(arg.value, arg.loc);
        }
      },
    };
  },
};

const semanticRefsExist = {
  meta: {
    type: "problem",
    docs: { description: "Every var() in semantic.css points at a defined token" },
    messages: { missing: "--{{name}} is not defined in primitives.css or semantic.css." },
    schema: [],
  },
  create(context) {
    const { primitive, semantic } = tokens();
    return {
      StyleSheet() {
        cssVarRefs(context.sourceCode, (name, loc) => {
          if (!primitive.has(name) && !semantic.has(name)) {
            context.report({ loc, messageId: "missing", data: { name } });
          }
        });
      },
    };
  },
};

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
/* Names that follow another convention on purpose. */
const KEBAB_EXEMPT = new Set([
  "zh-TW.ts", // BCP 47 language tag, matches the i18next language code
]);

const kebabCaseFilenames = {
  meta: {
    type: "suggestion",
    docs: { description: "File and folder names under src/ are kebab-case (bulletproof-react)" },
    messages: { notKebab: "'{{name}}' should be kebab-case." },
    schema: [],
  },
  create(context) {
    const check = (node) => {
      const parts = relative(`${ROOT}src`, context.filename).split(sep);
      if (parts[0] === ".." || KEBAB_EXEMPT.has(basename(context.filename))) return;
      const bad = parts.find((name) => !KEBAB.test(name));
      if (bad) {
        context.report({ loc: { line: 1, column: 0 }, node, messageId: "notKebab", data: { name: bad } });
      }
    };
    return { Program: check, StyleSheet: check };
  },
};

export default {
  meta: { name: "insightaero" },
  rules: {
    "no-primitive-tokens": noPrimitiveTokens,
    "semantic-refs-exist": semanticRefsExist,
    "kebab-case-filenames": kebabCaseFilenames,
  },
};
