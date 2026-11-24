'use client'

import type { HeroData } from '@pkg/design-system'
import { Hero } from '@pkg/design-system'
import { HeroNav } from './HeroNav'

export function HeroClient({ hero }: { hero: HeroData }) {
	return (
		<Hero hero={hero}>
			<Hero.Slide items={hero.items}>
				{(item) => (item.isLive ? <Hero.LiveContent item={item} /> : <Hero.Content item={item} />)}
			</Hero.Slide>
			<HeroNav />
			<Hero.Dots className='absolute bottom-5 left-0 z-20 3xl:pl-[var(--page-pad-3xl)] pl-[var(--page-pad-sm)] md:bottom-14 lg:pl-[var(--page-pad-lg)] xl:bottom-16 xl:pl-[var(--page-pad-xl)]' />
		</Hero>
	)
}
