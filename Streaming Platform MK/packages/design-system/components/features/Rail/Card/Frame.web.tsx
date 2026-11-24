import { cn } from '@pkg/utils'
import { cva } from 'class-variance-authority'
import type { CardAspect } from '../types'

const frame = cva(
	'relative overflow-hidden rounded-[6px] bg-surface transition-shadow duration-200 group-hover:shadow-[0_0_0_3px_#FFFFFF]',
	{
		variants: {
			aspect: {
				video: 'aspect-video',
				poster: 'aspect-poster',
				square: 'aspect-square',
				'4x3': 'aspect-4x3',
				'3x4': 'aspect-3x4',
				live: 'flex aspect-live items-center overflow-hidden bg-gradient-to-b from-live-grad-from to-live-grad-to py-4 pl-[13.5px]',
			},
		},
		defaultVariants: {
			aspect: 'video',
		},
	},
)

type CardFrameProps = {
	aspect?: CardAspect | 'live'
	className?: string
	children: React.ReactNode
}

export function CardFrame({ aspect, className, children }: CardFrameProps) {
	return <div className={cn(frame({ aspect }), className)}>{children}</div>
}
CardFrame.displayName = 'Card.Frame'
