// Workspace-wide ESLint flat config.
//
// Philosophy: tsc (strict) is the primary correctness gate — ESLint adds the
// bug-catchers TypeScript doesn't cover (unused code, floating promises are
// left to future type-aware linting, hook rules) without fighting the
// existing style. Prettier owns formatting; eslint-config-prettier disables
// anything that would conflict.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'apps/api/prisma/migrations/**',
      'apps/web/dev-dist/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // tsc strict already guards types; `any` appears deliberately at test
      // seams and third-party boundaries. Surface it, don't fail on it.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          // `const { omitted, ...rest } = row` is idiomatic field removal.
          ignoreRestSiblings: true,
        },
      ],
      // False positives on values only read inside Nest parameter decorators.
      'no-useless-assignment': 'off',
      // NestJS DI relies on parameter properties + empty constructors.
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // React hook rules for the web app.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Plain-JS utility scripts (seeders, smoke tests) run in Node.
  {
    files: ['scripts/**/*.mjs', '**/*.config.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  prettier,
);
