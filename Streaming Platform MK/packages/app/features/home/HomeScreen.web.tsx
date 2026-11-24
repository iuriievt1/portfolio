'use client'

import type { HeroData, RailData } from '@pkg/design-system'
import { Hero, PageContent, Rail, useHero } from '@pkg/design-system'

type HomeScreenProps = {
	hero: HeroData
	rails: RailData[]
}

export function HomeScreen({ hero, rails }: HomeScreenProps) {
	return (
		<>
			<Hero hero={hero}>
				<Hero.Slide items={hero.items}>{(item) => <Hero.Content item={item} />}</Hero.Slide>
				<HeroNav />
				<Hero.Dots className='absolute bottom-5 left-0 z-20 3xl:pl-[var(--page-pad-3xl)] pl-[var(--page-pad-sm)] md:bottom-14 lg:pl-[var(--page-pad-lg)] xl:bottom-16 xl:pl-[var(--page-pad-xl)]' />
			</Hero>
			<PageContent>
				{rails.map((rail) => (
					<Rail key={rail.id} id={rail.id} rail={rail}>
						<Rail.Title title={rail.title} viewAllHref={rail.viewAllHref} viewAllLabel={rail.viewAllLabel} />
						<Rail.Cards items={rail.items} viewAllHref={rail.viewAllHref} />
					</Rail>
				))}
			</PageContent>
		</>
	)
}

function HeroNav() {
	const { state, actions, meta } = useHero()
	const prev = () => actions.goTo((state.active - 1 + meta.count) % meta.count)
	const next = () => actions.goTo((state.active + 1) % meta.count)
	return (
		<>
			<Hero.Arrows direction='left' onClick={prev} />
			<Hero.Arrows direction='right' onClick={next} />
		</>
	)
}
