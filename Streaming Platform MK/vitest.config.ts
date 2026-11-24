import { resolve } from 'node:path'
import { reactNative } from '@srsholmes/vitest-react-native'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const pkgAliases = {
	'@env': resolve(__dirname, 'packages/app/data/__tests__/__env-stub.ts'),
	'@pkg/app': resolve(__dirname, 'packages/app/index.ts'),
	'@pkg/design-system/tailwind-preset': resolve(__dirname, 'packages/design-system/tailwind-preset.ts'),
	'@pkg/design-system': resolve(__dirname, 'packages/design-system/index.ts'),
	'@pkg/utils/client-env': resolve(__dirname, 'packages/utils/client-env.ts'),
	'@pkg/utils': resolve(__dirname, 'packages/utils/index.ts'),
	'@pkg/spatial-nav': resolve(__dirname, 'packages/spatial-nav/index.ts'),
	'@pkg/remote-session': resolve(__dirname, 'packages/remote-session/index.ts'),
}

export default defineConfig({
	test: {
		projects: [
			{
				resolve: {
					alias: {
						...pkgAliases,
						'react-native': resolve(__dirname, 'packages/utils/__mocks__/react-native.ts'),
					},
				},
				test: {
					name: 'logic',
					include: ['packages/**/__tests__/**/*.test.ts', 'packages/spatial-nav/__tests__/**/*.test.tsx'],
					environment: 'jsdom',
					globals: true,
				},
			},
			{
				plugins: [react(), reactNative()],
				resolve: { alias: pkgAliases },
				test: {
					name: 'components',
					include: ['packages/**/__tests__/**/*.test.tsx'],
					exclude: ['**/spatial-nav/__tests__/**/*.test.tsx'],
					environment: 'node',
					globals: true,
					setupFiles: ['./vitest.setup.ts'],
				},
			},
		],
	},
})
