import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config(
  {
    ignores: [
      '**/*.js',
      'dist/**',
      'vitest.config.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/quotes': ['warn', 'single'],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/no-extra-parens': 'warn',
      '@stylistic/indent': [
        'warn',
        2,
        {
          SwitchCase: 1,
          flatTernaryExpressions: true,
        },
      ],
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/explicit-module-boundary-types': [
        'warn',
        { allowArgumentsExplicitlyTypedAsAny: true },
      ],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      'no-unused-private-class-members': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^[_]',
          ignoreRestSiblings: true,
          vars: 'all',
        },
      ],
      'array-bracket-spacing': ['warn', 'never'],
      'array-element-newline': ['warn', 'consistent'],
      'arrow-spacing': 'warn',
      'comma-dangle': [
        'warn',
        {
          arrays: 'always-multiline',
          exports: 'always-multiline',
          functions: 'only-multiline',
          imports: 'always-multiline',
          objects: 'always-multiline',
        },
      ],
      'no-useless-rename': 'warn',
      'comma-spacing': [
        'warn',
        {
          after: true,
          before: false,
        },
      ],
      'eol-last': ['warn', 'never'],
      'for-direction': 'off',
      'function-call-argument-newline': ['warn', 'consistent'],
      'require-yield': 'off',
      'no-case-declarations': 'off',
      'no-console': [
        'warn',
        {
          allow: [
            'info',
            'warn',
            'error',
            'time',
            'timeEnd',
            'group',
            'groupEnd',
          ],
        },
      ],
      'no-constant-condition': ['warn'],
      'no-inner-declarations': 'off',
      'no-multiple-empty-lines': [
        'warn',
        {
          max: 2,
          maxEOF: 0,
        },
      ],
      'no-trailing-spaces': 'warn',
      'object-curly-newline': [
        'warn',
        {
          ExportDeclaration: {
            minProperties: 4,
            multiline: true,
          },
          ImportDeclaration: 'never',
          ObjectExpression: { multiline: true },
          ObjectPattern: { multiline: true },
        },
      ],
      'object-curly-spacing': ['warn', 'always'],
      'padding-line-between-statements': [
        'warn',
        {
          blankLine: 'never',
          next: 'import',
          prev: 'import',
        },
      ],
      'space-before-function-paren': [
        'warn',
        {
          anonymous: 'always',
          asyncArrow: 'always',
          named: 'never',
        },
      ],
      'prefer-const': ['warn'],
    },
  },
)