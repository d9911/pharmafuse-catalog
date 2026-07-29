import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'graphify-out/**', 'schema.gql'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: ['src/modules/*/domain/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.int-spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@nestjs/*',
            'typeorm',
            'graphql',
            '@/modules/*/application/*',
            '@/modules/*/infrastructure/*',
            '@/modules/*/presentation/*',
            '@/database/*',
            '../application/*',
            '../../application/*',
            '../infrastructure/*',
            '../../infrastructure/*',
            '../presentation/*',
            '../../presentation/*',
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/application/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.int-spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@nestjs/*',
            'typeorm',
            'graphql',
            '@/modules/*/infrastructure/*',
            '@/modules/*/presentation/*',
            '@/database/*',
            '../infrastructure/*',
            '../../infrastructure/*',
            '../presentation/*',
            '../../presentation/*',
            '../../../database/*',
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
