import tseslint from 'typescript-eslint'
import type { Linter } from 'eslint'

const config: Linter.Config[] = [
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
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
    },
    ignores:[
      'next-env.d.ts',
      '.next/**',
      '.dist/**',
      'node_modules/**',
    ],
  },
]

export default config
