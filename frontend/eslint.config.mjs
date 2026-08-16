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
  {
    // The admin had 108 distinct hardcoded hex values against 26 uses of the
    // brand tokens — including three different reds all meaning "danger", and
    // literals that were byte-identical to tokens that already existed
    // (#2d7d47 === --color-success, 35 times). Same disease as the storefront's
    // hand-built URLs: a value with no owner drifts. The storefront rule lives
    // in Conventions; this makes it enforceable in the admin too.
    files: ['app/admin/**/*.tsx', 'app/admin/**/*.ts'],
    rules: {
      // Restates the product-URL selector: flat config REPLACES a rule's
      // options, so declaring only the colour one switched the URL guard off
      // for the whole admin. The inline eslint-disable comments on the admin's
      // preview links started reporting as "unused directive" — that warning was
      // the guard announcing it had stopped running.
      'no-restricted-syntax': ['error',
        {
          selector: "TemplateLiteral > TemplateElement[value.raw=/\\/product\\/$/]",
          message: "Don't hand-build product URLs — use productPath/productHref from '@/lib/urls' so links are always canonical (slug, not ObjectId).",
        },
        {
          // Hex AND colour keywords. The first version of this rule caught only
          // hex, so 145 uses of literal 'white' walked straight through it —
          // including one inside the shared Card, which is why the workspace
          // palette never reached the component meant to define it.
          selector: "Literal[value=/^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|white|black|red|green|blue|orange|yellow|purple|grey|gray)$/]",
          message:
            "Don't hardcode hex in the admin — use the --admin-*/--color-* tokens from globals.css " +
            "(--color-ink, --color-line, --color-success, --color-danger, --color-gold, …). " +
            "If a third-party widget genuinely needs a literal, disable this rule on that line with a reason.",
        },
      ],
    },
  },
  {
    // Recharts takes literal colours into SVG attributes and its own style
    // objects — see the note at the top of the file.
    files: ['app/admin/_components/dashboard/Zone2Metrics.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // "Never hardcode hex on the storefront" was written in PROJECT_MAP as a
    // convention and nowhere as a check, so 151 literals accumulated under it —
    // including exact re-typings of tokens that already existed. A convention
    // nothing enforces is a preference.
    //
    // 'warn' while the near-miss shades are still being consolidated; the
    // exact-value matches are already migrated. Flip to 'error' once the tail
    // lands, as the admin rule did.
    files: ['app/(shop)/**/*.tsx', 'components/**/*.tsx'],
    ignores: ['app/(shop)/**/opengraph-image.tsx', 'app/(shop)/**/twitter-image.tsx'],
    rules: {
      // Flat config REPLACES a rule's options rather than merging them, so the
      // product-URL selector has to be restated here. Declaring only the colour
      // selector silently switched the URL guard off for exactly the files it
      // was written to protect.
      'no-restricted-syntax': ['warn',
        {
          selector: "TemplateLiteral > TemplateElement[value.raw=/\\/product\\/$/]",
          message: "Don't hand-build product URLs — use productPath/productHref from '@/lib/urls' so links are always canonical (slug, not ObjectId).",
        },
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
          message:
            "Don't hardcode hex on the storefront — use the brand tokens in globals.css " +
            "(--color-ink, --color-bg, --color-line, --color-accent, --color-success, …). " +
            "Image-generation routes (Satori) are exempt: var() does not resolve there.",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
