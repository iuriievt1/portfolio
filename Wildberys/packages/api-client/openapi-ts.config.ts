import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  // Written by the API, see `pnpm api-client:generate`.
  input: './openapi.json',
  output: {
    path: './src/generated',
    fileName: {
      // The generator names some files in camelCase, the repository uses kebab-case.
      name: (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
    },
  },
  plugins: [
    { name: '@hey-api/client-fetch', includeInEntry: true },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
