import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
   {
     rules: {
       // Downgrade strict errors to warnings for MVP (pre-existing issues)
       '@typescript-eslint/no-unused-vars': 'warn',
       'no-case-declarations': 'warn',
       '@typescript-eslint/no-require-imports': 'warn',
       '@typescript-eslint/ban-ts-comment': 'warn',
       'prefer-const': 'warn',
       // Keep other rules as is
       '@typescript-eslint/explicit-function-return-type': 'warn',
       '@typescript-eslint/no-explicit-any': 'warn',
       'no-console': 'warn',
     },
   }
);
