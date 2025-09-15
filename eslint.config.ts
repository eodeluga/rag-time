// eslint.config.ts
import tseslint from 'typescript-eslint'
import type { Linter } from 'eslint'
import globals from 'globals'
import importPlugin from 'eslint-plugin-import'

const config: Linter.Config[] = [
  ...tseslint.configs.recommendedTypeChecked,
  // add the import plugin so ESLint can resolve TS path aliases
  {
    plugins: {
      import: importPlugin,
    },
    settings: {
      // tell eslint-plugin-import how to resolve @/* using your tsconfig
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json'],
        },
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/array-type': ['error', { default: 'array' }],

      'comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          functions: 'never',
        },
      ],
      'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'semi': ['error', 'never'],
      'space-before-function-paren': ['error', { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
      'eol-last': ['error', 'always'],
      'max-len': ['error', { code: 130 }],
      'object-curly-newline': ['error', { multiline: true, consistent: true }],
      'object-curly-spacing': ['warn', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'operator-linebreak': ['error', 'before'],
      '@typescript-eslint/prefer-as-const': 'error',
      'prefer-const': [
        'error', {
          'destructuring': 'any',
          'ignoreReadBeforeAssign': false,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-loop-func': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'LabeledStatement',
          message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
        },
        {
          selector: 'WithStatement',
          message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
        },
      ],
      'prefer-destructuring': ['error', {
        'array': false,
        'object': false,
      }, {
          enforceForRenamedProperties: false,
        }],
      '@typescript-eslint/restrict-template-expressions': ['error', {
        'allowNumber': true,
        'allowBoolean': false,
        'allowAny': true,
        'allowNullish': false,
        'allowRegExp': false,
      }],
      '@typescript-eslint/strict-boolean-expressions': 'off',
    },
    ignores: [
      'next-env.d.ts',
      '.next/**',
      '.dist/**',
      'node_modules/**',
    ],
  },
]

export default config
