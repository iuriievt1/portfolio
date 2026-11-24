'use client'

import { cn } from '@pkg/utils'
import { useHero } from '../hooks/use-hero'

type DotsProps = {
	className?: string
}

export function Dots({ className }: DotsProps) {
	const { state, actions, meta } = useHero()
	if (meta.count <= 1) return null

	return (
		<div className={cn('flex items-center gap-2', className)}>
			{Array.from({ length: meta.count }, (_, i) => (
				<Dot
					// biome-ignore lint/suspicious/noArrayIndexKey: dots are index-based, never reordered
					key={i}
					index={i}
					isActive={i === state.active}
					isDone={i < state.active}
					progressKey={state.progressKey}
					autoPlayMs={meta.autoPlayMs}
					isPaused={state.showControls}
					onGoTo={actions.goTo}
				/>
			))}
		</div>
	)
}
Dots.displayName = 'Hero.Dots'

type DotProps = {
	index: number
	isActive: boolean
	isDone: boolean
	progressKey: number
	autoPlayMs: number
	isPaused: boolean
	onGoTo: (i: number) => void
}

function Dot({ index, isActive, isDone, progressKey, autoPlayMs, isPaused, onGoTo }: DotProps) {
	return (
		<button
			key={index}
			type='button'
			onClick={() => onGoTo(index)}
			aria-label={`Go to slide ${index + 1}`}
			className={cn(
				'relative h-1.5 overflow-hidden rounded-full transition-all duration-300',
				isActive ? 'w-10' : 'w-5',
			)}
		>
			<span className='absolute inset-0 bg-white/30' />
			{isDone && <span className='absolute inset-y-0 left-0 w-full bg-white' />}
			{isActive && (
				<span
					key={progressKey}
					className='absolute inset-y-0 left-0 bg-white'
					style={{
						animation: `heroProgress ${autoPlayMs}ms linear forwards`,
						animationPlayState: isPaused ? 'paused' : 'running',
					}}
				/>
			)}
		</button>
	)
}
