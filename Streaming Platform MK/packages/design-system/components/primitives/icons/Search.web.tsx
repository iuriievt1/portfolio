import { cn } from '@pkg/utils'

type SearchProps = {
	className?: string
}

export function SearchIcon({ className }: SearchProps) {
	return (
		<svg viewBox='0 0 24 24' className={cn(className)} fill='none' aria-hidden='true'>
			<circle cx='11' cy='11' r='7' stroke='currentColor' strokeWidth='2' />
			<path d='M16 16l4.5 4.5' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
		</svg>
	)
}
SearchIcon.displayName = 'SearchIcon'
