import type { HeroData, RailData } from '@pkg/design-system'

type SportsScreenProps = {
	hero?: HeroData
	rails?: RailData[]
}

// Web sports page uses Next.js server/client components directly in apps/next/app/sports/.
// This stub exists only for TypeScript module resolution (moduleSuffixes: [".web", ""]).
export function SportsScreen(_props: SportsScreenProps) {
	return null
}
