import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';

import { base } from './base.js';

/**
 * Next.js apps: Next.js rules on top of the shared base.
 * @param {{ tsconfigRootDir: string }} options
 */
export function next({ tsconfigRootDir }) {
  return defineConfig(
    globalIgnores(['.next/**', 'next-env.d.ts']),
    nextVitals,
    nextTypescript,
    base({ tsconfigRootDir }),
    {
      rules: {
        'check-file/folder-naming-convention': ['error', { 'src/**/': 'NEXT_JS_APP_ROUTER_CASE' }],
      },
    },
  );
}
