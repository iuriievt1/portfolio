import { base } from '@bluberi/config/eslint/base';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  // The client, written by `pnpm api-client:generate`.
  globalIgnores(['src/generated/**']),
  base({ tsconfigRootDir: import.meta.dirname }),
);
