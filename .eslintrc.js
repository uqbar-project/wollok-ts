module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        // 'plugin:prettier/@typescript-eslint',
    ],
    rules: {
        'semi': ['error', 'never'],
        'quotes': [
            'error',
            'single',
            {
                'allowTemplateLiterals': true,
            },
        ],
        'comma-dangle': [
            'error',
            'only-multiline',
            {
                'objects': 'only-multiline',
                'arrays': 'only-multiline',
                'functions': 'ignore',
            },
        ],
        'for-direction': 'off',
        'space-before-function-paren': [
            'error',
            {
                'anonymous': 'always',
                'named': 'never',
                'asyncArrow': 'always',
            },
        ],
        'no-multiple-empty-lines': 'error',
        'max-len': [
            'warn',
            {
                'code': 140,
                'ignorePattern': '^import |^export ',
            },
        ],
        'arrow-parens': 'off',
        'curly': 'off',
        'eol-last': 'off',
        'max-classes-per-file': 'off',
        'no-empty': 'off',
        'sort-keys': 'off',
        '@typescript-eslint/array-type': [
            'error',
            {
                'default': 'array',
            },
        ],
        '@typescript-eslint/explicit-member-accessibility': 'off',
        '@typescript-eslint/naming-convention': [
            'error',
            {
                'selector': 'default',
                'format': [
                    'camelCase',
                    'PascalCase',
                    'UPPER_CASE'
                ],
                'leadingUnderscore': 'allow',
            }
        ],
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/member-ordering': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/prefer-interface': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                'argsIgnorePattern': '^_',
            }
        ],
        '@typescript-eslint/member-delimiter-style': [
            'error',
            {
                multiline: {
                    delimiter: 'none',
                    requireLast: true,
                },
                singleline: {
                    delimiter: 'comma',
                    requireLast: false,
                },
            }
        ]
    },

    overrides: [
        {
            files: [
                'scripts/**/*ts',
                'test/**/*.ts',
            ],
            rules: {
                'max-len': 'off',
                'prefer-rest-params': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/no-explicit-any': 'off',
                '@typescript-eslint/naming-convention': 'off',
                '@typescript-eslint/camelcase': 'off',
                '@typescript-eslint/no-use-before-define': 'off',
                '@typescript-eslint/no-namespace': 'off',
            },
        }
    ]
};