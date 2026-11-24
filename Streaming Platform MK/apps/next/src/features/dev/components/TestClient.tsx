'use client'

import { HomeScreen } from '@pkg/app/features/home'
import { SportsScreen } from '@pkg/app/features/sports'
import type { HeroData, RailData } from '@pkg/design-system'

type TestClientProps = {
	vodHero: HeroData | null
	liveHero: HeroData | null
	rails: RailData[]
}

export function TestClient({ vodHero, liveHero, rails }: TestClientProps) {
	return (
		<div className='space-y-16'>
			{vodHero && (
				<section>
					<SectionLabel>HomeScreen — VOD Hero</SectionLabel>
					<HomeScreen hero={vodHero} rails={rails} />
				</section>
			)}

			{liveHero && (
				<section>
					<SectionLabel>SportsScreen — Live Hero</SectionLabel>
					<SportsScreen hero={liveHero} rails={rails} />
				</section>
			)}
		</div>
	)
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<h2 className='3xl:px-[var(--page-pad-3xl)] px-[var(--page-pad-sm)] pt-4 font-semibold text-sm text-white/50 uppercase tracking-widest lg:px-[var(--page-pad-lg)] xl:px-[var(--page-pad-xl)]'>
			{children}
		</h2>
	)
}
