import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import type { NextConfig } from 'next'

const __dir = typeof __dirname !== 'undefined' ? __dirname : fileURLToPath(new URL('.', import.meta.url))
const worktreeRoot = resolve(__dir, '../..')

// Load monorepo root .env (Next.js only reads apps/next/.env by default)
loadEnv({ path: resolve(worktreeRoot, '.env') })
const envShim = resolve(__dir, 'env-shim.ts')
const isStaticExport = Boolean(process.env.STATIC_EXPORT)
const mkApiHost = process.env.NEXT_PUBLIC_MK_API_HOST || process.env.MK_API_HOST || ''

const nextConfig: NextConfig = {
	output: isStaticExport ? 'export' : undefined,
	basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
	trailingSlash: true,
	images: {
		unoptimized: true,
	},
	productionBrowserSourceMaps: false,
	experimental: {
		staleTimes: { dynamic: 300, static: 300 },
	},
	...(isStaticExport
		? {}
		: {
				// Dev proxy: rewrites /mk-api/* to MK API host, bypassing CORS in local dev.
				async rewrites() {
					if (!mkApiHost) return []
					return [{ source: '/mk-api/:path*', destination: `${mkApiHost.replace(/\/$/, '')}/:path*` }]
				},
			}),
	transpilePackages: ['@pkg/app', '@pkg/design-system', '@pkg/utils'],
	turbopack: {
		root: worktreeRoot,
		resolveAlias: { '@env': './env-shim.ts' },
		resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
	},
	webpack: (config) => {
		config.resolve.alias = { ...config.resolve.alias, '@env': envShim }
		config.resolve.extensions = ['.web.tsx', '.web.ts', '.web.js', ...(config.resolve.extensions ?? [])]
		return config
	},
}

export default nextConfig
