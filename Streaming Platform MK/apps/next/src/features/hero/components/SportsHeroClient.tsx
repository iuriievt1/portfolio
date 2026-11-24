'use client'

import type { HeroData } from '@pkg/design-system'
import { Hero } from '@pkg/design-system'
import { HeroNav } from './HeroNav'

/**
 * Live event hero — used by sports and any page featuring live broadcasts.
 * Composes: Slide → LiveContent (outline badge, startTime, "Watch Live") + BrandingLogo.
 *
 * BrandingLogo renders only when item.brandingLogoUrl is present,
 * so slides without a sponsor logo gracefully omit it.
 *
 * For VOD pages (home, kids), use HeroClient (Slide → Content).
 */
export function SportsHeroClient({ hero }: { hero: HeroData }) {
	return (
		<Hero hero={hero}>
			<Hero.Slide items={hero.items}>
				{(item) => (
					<>
						<Hero.LiveContent item={item} />
						<Hero.BrandingLogo item={item} />
					</>
				)}
			</Hero.Slide>
			<HeroNav />
			<Hero.Dots className='absolute bottom-5 left-0 z-20 3xl:pl-[var(--page-pad-3xl)] pl-[var(--page-pad-sm)] md:bottom-14 lg:pl-[var(--page-pad-lg)] xl:bottom-16 xl:pl-[var(--page-pad-xl)]' />
		</Hero>
	)
}
