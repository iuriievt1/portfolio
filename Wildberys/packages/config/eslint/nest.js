import { defineConfig } from 'eslint/config';
import globals from 'globals';

import { base } from './base.js';

/**
 * NestJS apps: Node.js globals and decorated module classes on top of the shared base.
 * @param {{ tsconfigRootDir: string }} options
 */
export function nest({ tsconfigRootDir }) {
  return defineConfig(base({ tsconfigRootDir }), {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  });
}
