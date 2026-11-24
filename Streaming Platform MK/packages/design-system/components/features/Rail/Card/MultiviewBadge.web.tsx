import { cn } from '@pkg/utils'
import { PALETTE, rgb } from '../../../../tokens/primitives'
import { useCardMeta } from './context'

const PAGE_BG = rgb(PALETTE.pageBg)

type CardMultiviewBadgeProps = { className?: string }

function MultiviewIcon2() {
	return (
		<svg width='35' height='23' viewBox='0 0 35 23' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden>
			<line x1='26.8779' y1='13.7415' x2='0.87793' y2='13.7415' stroke='white' strokeWidth='2' />
			<rect x='1' y='5.19971' width='25.7181' height='16.0587' rx='1.80707' stroke='white' strokeWidth='2' />
			<rect x='23' width='12' height='12' rx='6' fill='white' />
			<path
				d='M31.49 9.5H26.47V8.39C29.2 6.37 30 5.68 30 4.86C30 4.28 29.47 3.99 28.92 3.99C28.16 3.99 27.58 4.29 27.13 4.76L26.32 3.82C26.97 3.07 27.96 2.73 28.89 2.73C30.31 2.73 31.44 3.53 31.44 4.86C31.44 6 30.5 6.99 28.77 8.25H31.49V9.5Z'
				fill={PAGE_BG}
			/>
		</svg>
	)
}

function MultiviewIcon3() {
	return (
		<svg width='35' height='23' viewBox='0 0 35 23' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden>
			<line x1='17' y1='5' x2='17' y2='22' stroke='white' strokeWidth='2' />
			<line x1='26.8782' y1='14.019' x2='16.7989' y2='14.019' stroke='white' strokeWidth='2' />
			<rect x='1' y='5.19971' width='25.7181' height='16.0587' rx='1.80707' stroke='white' strokeWidth='2' />
			<rect x='23' width='12' height='12' rx='6' fill='white' />
			<path
				d='M28.83 9.62C27.6 9.62 26.69 9.15 26.2 8.55L26.94 7.6C27.4 8.08 28.13 8.36 28.78 8.36C29.59 8.36 30.04 8.01 30.04 7.51C30.04 6.98 29.63 6.74 28.7 6.74C28.42 6.74 27.97 6.75 27.87 6.76V5.48C27.99 5.49 28.45 5.49 28.7 5.49C29.44 5.49 29.93 5.27 29.93 4.78C29.93 4.25 29.39 3.99 28.69 3.99C28.05 3.99 27.47 4.23 27 4.68L26.29 3.79C26.83 3.18 27.67 2.73 28.84 2.73C30.4 2.73 31.36 3.43 31.36 4.54C31.36 5.38 30.64 5.93 29.9 6.06C30.58 6.13 31.46 6.66 31.46 7.66C31.46 8.81 30.43 9.62 28.83 9.62Z'
				fill={PAGE_BG}
			/>
		</svg>
	)
}

function MultiviewIcon4() {
	return (
		<svg width='35' height='23' viewBox='0 0 35 23' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden>
			<line x1='26.8779' y1='13.7415' x2='0.87793' y2='13.7415' stroke='white' strokeWidth='2' />
			<line x1='14' y1='21.7366' x2='14' y2='4.73657' stroke='white' strokeWidth='2' />
			<rect x='1' y='5.19971' width='25.7181' height='16.0587' rx='1.80707' stroke='white' strokeWidth='2' />
			<rect x='23' width='12' height='12' rx='6' fill='white' />
			<path
				d='M30.86 9.5H29.44V8.12H26.25V7L28.9 2.83H30.86V6.87H31.72V8.12H30.86V9.5ZM29.44 6.87V4.09L27.64 6.87H29.44Z'
				fill={PAGE_BG}
			/>
		</svg>
	)
}

const iconByCount: Record<number, () => React.ReactNode> = {
	2: MultiviewIcon2,
	3: MultiviewIcon3,
	4: MultiviewIcon4,
}

export function CardMultiviewBadge({ className }: CardMultiviewBadgeProps) {
	const { item } = useCardMeta()
	if (item.variant !== 'multiview' || !item.multiviewCount) return null

	const Icon = iconByCount[item.multiviewCount]
	if (!Icon) return null

	return (
		<div className={cn('absolute top-card-badge-inset right-card-badge-inset z-10', className)}>
			<Icon />
		</div>
	)
}
CardMultiviewBadge.displayName = 'Card.MultiviewBadge'
