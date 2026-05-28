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
