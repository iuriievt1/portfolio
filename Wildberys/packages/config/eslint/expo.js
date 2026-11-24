import expoConfig from 'eslint-config-expo/flat.js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

import { base } from './base.js';

/**
 * Expo apps: Expo rules on top of the shared base.
 * Expo Router reserves file names like _layout, +not-found and [id], so route files keep them.
 * @param {{ tsconfigRootDir: string }} options
 */
export function expo({ tsconfigRootDir }) {
  return defineConfig(
    globalIgnores(['.expo/**', 'expo-env.d.ts']),
    expoConfig,
    base({ tsconfigRootDir }),
    {
      rules: {
        'check-file/filename-naming-convention': [
          'error',
          {
            '*.{js,mjs,cjs,ts}': 'KEBAB_CASE',
            'src/**/!(_layout|\\+*|\\[*).{ts,tsx}': 'KEBAB_CASE',
          },
          { ignoreMiddleExtensions: true },
        ],
        'check-file/folder-naming-convention': ['error', { 'src/**/': 'NEXT_JS_APP_ROUTER_CASE' }],
      },
    },
    {
      // Metro loads its config as CommonJS.
      files: ['metro.config.js'],
      languageOptions: { sourceType: 'commonjs', globals: globals.node },
      rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
  );
}
