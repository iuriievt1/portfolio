import { cn } from '@pkg/utils'

type CloseProps = {
	className?: string
}

export function CloseIcon({ className }: CloseProps) {
	return (
		<svg viewBox='0 0 24 24' className={cn(className)} fill='none' aria-hidden='true'>
			<path d='M18 6L6 18M6 6l12 12' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
		</svg>
	)
}
CloseIcon.displayName = 'CloseIcon'
