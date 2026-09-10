import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone one-off scripts at the repo root — CommonJS, not part of the
    // Next build and not imported by anything in src/.
    "make-pitch.js",
    "pptx-to-pdf.js",
  ]),
]);

export default eslintConfig;
