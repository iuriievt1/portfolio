import { cn } from '@pkg/utils'

type TrophyProps = {
	className?: string
}

export function TrophyIcon({ className }: TrophyProps) {
	return (
		<svg viewBox='0 0 24 24' className={cn(className)} fill='none' aria-hidden='true'>
			<path d='M6 3h12v6a6 6 0 01-12 0V3z' stroke='currentColor' strokeWidth='2' strokeLinejoin='round' />
			<path
				d='M6 6H4v2a3 3 0 003 3'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
			<path
				d='M18 6h2v2a3 3 0 01-3 3'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
			<path d='M9 21h6M12 15v6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
		</svg>
	)
}
TrophyIcon.displayName = 'TrophyIcon'
