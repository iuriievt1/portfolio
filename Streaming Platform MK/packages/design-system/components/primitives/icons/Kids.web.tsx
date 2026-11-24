import { cn } from '@pkg/utils'

type KidsProps = {
	className?: string
}

export function KidsIcon({ className }: KidsProps) {
	return (
		<svg viewBox='0 0 24 24' className={cn(className)} fill='none' aria-hidden='true'>
			<path
				d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinejoin='round'
			/>
		</svg>
	)
}
KidsIcon.displayName = 'KidsIcon'
