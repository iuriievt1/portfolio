import { cn } from '@pkg/utils'

type HomeProps = {
	className?: string
}

export function HomeIcon({ className }: HomeProps) {
	return (
		<svg viewBox='0 0 24 24' className={cn(className)} fill='none' aria-hidden='true'>
			<path d='M3 12l9-8 9 8' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
			<path
				d='M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	)
}
HomeIcon.displayName = 'HomeIcon'
