import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import next from '@next/eslint-plugin-next';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { '@next/next': next, 'react-hooks': hooks },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
      ...hooks.configs.recommended.rules,
    },
  },
  globalIgnores(['.next/**', 'out/**', 'coverage/**', 'next-env.d.ts']),
]);
