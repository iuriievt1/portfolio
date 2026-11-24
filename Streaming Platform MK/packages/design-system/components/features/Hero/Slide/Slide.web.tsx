'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { DURATION, EASING } from '../../../../tokens/animation'
import { useHeroState } from '../hooks/use-hero'
import type { HeroItemData } from '../types'

const PRELOAD_READY_DELAY_MS = 1500

const variants = {
	enter: (dir: 1 | -1) => ({ x: dir === 1 ? '8%' : '-8%', opacity: 0, scale: 1.01 }),
	center: { x: '0%', opacity: 1, scale: 1 },
	exit: (dir: 1 | -1) => ({ x: dir === 1 ? '-6%' : '6%', opacity: 0, scale: 0.99 }),
}

const transition = {
	x: { type: 'tween' as const, ease: EASING.smoothOut, duration: DURATION.heroSlide / 1000 },
	opacity: { duration: DURATION.opacity / 1000 },
	scale: { duration: DURATION.heroSlide / 1000 },
}

type SlideProps = {
	items: HeroItemData[]
	children?: (item: HeroItemData) => React.ReactNode
}

export function Slide({ items, children }: SlideProps) {
	const { state } = useHeroState()
	const item = items[state.active]
	if (!item) return null

	return (
		<>
			<AnimatePresence initial={false} custom={state.direction} mode='sync'>
				<motion.div
					key={item.id}
					custom={state.direction}
					variants={variants}
					initial='enter'
					animate='center'
					exit='exit'
					transition={transition}
					className='absolute inset-0 will-change-transform'
				>
					{item.imageUrl ? (
						<Image
							src={item.imageUrl}
							alt={item.title}
							fill
							priority={state.active === 0}
							sizes='(max-width: 1920px) 100vw, 1920px'
							className='object-cover'
							style={{ objectPosition: item.imagePosition ?? 'center' }}
						/>
					) : (
						<div className='absolute inset-0 bg-surface' />
					)}
					<SlideGradients />
					{children?.(item)}
				</motion.div>
			</AnimatePresence>

			<HeroPreloader items={items} activeIndex={state.active} />
		</>
	)
}
Slide.displayName = 'Hero.Slide'

// ---------------------------------------------------------------------------
// Preloads remaining hero images after first paint so arrow navigation is instant.
// ---------------------------------------------------------------------------

function HeroPreloader({ items, activeIndex }: { items: HeroItemData[]; activeIndex: number }) {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		const id = setTimeout(() => setReady(true), PRELOAD_READY_DELAY_MS)
		return () => clearTimeout(id)
	}, [])

	if (!ready || items.length <= 1) return null

	return (
		<div aria-hidden className='pointer-events-none invisible absolute h-0 w-0 overflow-hidden'>
			{items.map((slide, i) => {
				if (i === activeIndex || !slide.imageUrl) return null
				return (
					<Image
						key={slide.id}
						src={slide.imageUrl}
						alt=''
						width={1}
						height={1}
						loading='lazy'
						sizes='(max-width: 1920px) 100vw, 1920px'
						className='opacity-0'
					/>
				)
			})}
		</div>
	)
}

function SlideGradients() {
	return (
		<>
			<div className='pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-black/75 to-transparent' />
			<div className='pointer-events-none absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-black/85 via-black/40 to-transparent md:w-1/2' />
			<div className='pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-page-bg to-transparent' />
		</>
	)
}
