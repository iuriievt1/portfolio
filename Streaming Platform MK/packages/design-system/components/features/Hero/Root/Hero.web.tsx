'use client'

import { cn } from '@pkg/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DURATION } from '../../../../tokens/animation'
import { HeroMetaContext, HeroStateContext } from '../context'
import { useHeroCarousel } from '../hooks/use-hero-carousel'
import type { HeroData } from '../types'

type HeroProps = {
	hero: HeroData
	className?: string
	children: React.ReactNode
}

export function Hero({ hero, className, children }: HeroProps) {
	const { items, autoPlayMs = 6000 } = hero
	const count = items.length
	const [showControls, setShowControls] = useState(false)
	const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const clearIdle = useCallback(() => {
		if (idleTimer.current) {
			clearTimeout(idleTimer.current)
			idleTimer.current = null
		}
	}, [])

	const startIdle = useCallback(() => {
		clearIdle()
		idleTimer.current = setTimeout(() => setShowControls(false), DURATION.controlsIdle)
	}, [clearIdle])

	const handleMouseMove = useCallback(() => {
		setShowControls(true)
		startIdle()
	}, [startIdle])

	const handleMouseLeave = useCallback(() => {
		setShowControls(false)
		clearIdle()
	}, [clearIdle])

	useEffect(() => clearIdle, [clearIdle])

	const { active, progressKey, direction, goTo } = useHeroCarousel({
		count,
		autoPlayMs,
		paused: showControls,
	})

	const meta = useMemo(() => ({ count, autoPlayMs }), [count, autoPlayMs])

	const stateValue = useMemo(
		() => ({
			state: { active, progressKey, direction, isHovered: false, showControls },
			actions: { goTo, setIsHovered: () => {} },
		}),
		[active, progressKey, direction, showControls, goTo],
	)

	if (count === 0) return null

	return (
		<HeroMetaContext value={meta}>
			<HeroStateContext value={stateValue}>
				<section
					onMouseMove={handleMouseMove}
					onMouseLeave={handleMouseLeave}
					className={cn(
						'relative w-full overflow-hidden',
						'-mt-appbar-sm md:-mt-appbar-md',
						// Key art is 16:9 — a shorter box would crop it, so the height follows the width.
						// The viewport is the only ceiling, for windows wider than 16:9.
						'aspect-video max-h-[100svh] min-h-[320px]',
						className,
					)}
				>
					{children}
				</section>
			</HeroStateContext>
		</HeroMetaContext>
	)
}
Hero.displayName = 'Hero'
