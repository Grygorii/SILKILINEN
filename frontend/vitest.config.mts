import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Pure-logic tests for the storefront. There was no test runner here at all, so
// every rule in lib/ was guarded by tsc and eslint only — neither of which can
// tell whether isExcludedFromAnalytics actually excludes anything, or whether
// productPath builds the URL Google is supposed to see.
//
// Deliberately NOT a component/DOM setup: no jsdom, no React Testing Library, no
// snapshot infrastructure. The frontend's risky parts are plain functions in
// lib/ — URL construction, meta clamping, what analytics must ignore — and each
// one has already shipped a bug that a three-line test would have caught. A
// browser environment would add install weight and maintenance for a kind of
// test nobody here has asked for yet.
export default defineConfig({
  resolve: {
    // Mirrors the "@/*" -> "./*" alias in tsconfig.json, so tests import modules
    // exactly as the app does rather than by relative path.
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
