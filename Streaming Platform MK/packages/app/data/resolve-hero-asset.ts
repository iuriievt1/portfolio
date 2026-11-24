/** Prepend basePath so public-folder assets work under sub-path deployments. */
export function resolveHeroAsset(path: string): string {
	const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
	return `${base}${path}`
}
