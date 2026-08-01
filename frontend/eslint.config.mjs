import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// F23: eslint-config-next already bundles eslint-plugin-jsx-a11y at the
// "recommended" preset, so a11y issues (missing alt text, label
// associations, role mismatches) are already linted as part of `npm
// run lint`. Adding the plugin again would error with "Cannot redefine
// plugin". To upgrade specific rules to error level, override here
// rather than re-importing the plugin.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Promote the highest-signal a11y rules from warn to error so
      // they fail CI rather than getting ignored in the warning noise.
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      // Canonical URLs by construction. Product links used to be hand-built in
      // six places three different ways; the colour-swatch links used the raw
      // ObjectId, so Google indexed /product/<ObjectId> next to the slug URL —
      // two URLs for one page. Build them with lib/urls (productPath /
      // productHref) so a wrong URL can't be written in the first place.
      'no-restricted-syntax': ['error', {
        selector: "TemplateLiteral > TemplateElement[value.raw=/\\/product\\/$/]",
        message: "Don't hand-build product URLs — use productPath/productHref from '@/lib/urls' so links are always canonical (slug, not ObjectId).",
      }],
    },
  },
  {
    // lib/urls.ts is where the canonical URL is defined, so it's the one place
    // allowed to construct the string.
    files: ['lib/urls.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
