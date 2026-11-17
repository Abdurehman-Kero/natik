import { base } from '@natik/config/eslint/base.mjs';

export default [
  ...base,
  {
    rules: {
      // NestJS relies on classes injected by type; these imports are used at runtime.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
