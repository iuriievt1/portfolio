import { dsPreset } from '@pkg/design-system/tailwind-preset'
import type { Config } from 'tailwindcss'

const config: Config = {
	content: [
		'./src/**/*.{ts,tsx}',
		'../../packages/app/{data,features,hooks,navigation,providers,types}/**/*.{ts,tsx}',
		'../../packages/app/index.ts',
		'../../packages/design-system/{components,tokens,types}/**/*.{ts,tsx}',
		'../../packages/design-system/index.ts',
	],
	presets: [dsPreset as unknown as Config],
	plugins: [],
}

export default config
