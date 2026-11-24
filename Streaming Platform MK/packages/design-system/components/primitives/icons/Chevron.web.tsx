import { cn } from '@pkg/utils'

type ChevronProps = {
	direction?: 'left' | 'right' | 'up' | 'down'
	className?: string
}

const rotations = {
	left: '',
	right: 'rotate-180',
	up: '-rotate-90',
	down: 'rotate-90',
} as const

export function ChevronIcon({ direction = 'left', className }: ChevronProps) {
	return (
		<svg viewBox='0 0 24 24' className={cn(rotations[direction], className)} fill='none' aria-hidden='true'>
			<path d='M15 6l-6 6 6 6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
		</svg>
	)
}
ChevronIcon.displayName = 'ChevronIcon'
