import { nest } from '@bluberi/config/eslint/nest';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  // The Prisma client, written by `prisma generate`.
  globalIgnores(['src/generated/**']),
  nest({ tsconfigRootDir: import.meta.dirname }),
);
