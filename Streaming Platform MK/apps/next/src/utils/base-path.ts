import { resolveHeroAsset } from '@pkg/app/data/resolve-hero-asset'

/** Prepend NEXT_PUBLIC_BASE_PATH to a local asset path (e.g. `/logos/foo.png`). */
export const withBasePath = resolveHeroAsset
