import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';

export default ts.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.pnpm-store/**',
      '**/dist/**',
      '**/.next/**',
      '**/next-env.d.ts',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.local/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': hooks },
    rules: { ...hooks.configs.recommended.rules, 'react-hooks/set-state-in-effect': 'off' },
  },
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
);
