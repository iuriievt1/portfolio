'use client'

import { Hero, useHero } from '@pkg/design-system'

export function HeroNav() {
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
