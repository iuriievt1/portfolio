import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import checkFile from 'eslint-plugin-check-file';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Rules shared by every package: strict type-aware TypeScript and kebab-case file names.
 * @param {{ tsconfigRootDir: string }} options
 */
export function base({ tsconfigRootDir }) {
  return defineConfig(
    globalIgnores(['dist/**', 'coverage/**']),
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    {
      plugins: { 'check-file': checkFile },
      rules: {
        'check-file/filename-naming-convention': [
          'error',
          { '**/*.{js,mjs,cjs,ts,tsx}': 'KEBAB_CASE' },
          { ignoreMiddleExtensions: true },
        ],
        'check-file/folder-naming-convention': ['error', { 'src/**/': 'KEBAB_CASE' }],
      },
    },
    prettier,
  );
}
