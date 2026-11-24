export function Nav({ children }: { children: React.ReactNode }) {
	return (
		<nav aria-label='Footer'>
			<ul className='flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm lg:justify-start'>
				{children}
			</ul>
		</nav>
	)
}
Nav.displayName = 'Footer.Nav'
