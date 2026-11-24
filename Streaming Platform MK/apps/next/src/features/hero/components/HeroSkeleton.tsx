/** Box mirrors Hero so the page does not jump when the real hero replaces it. */
export function HeroSkeleton() {
	return (
		<section className='-mt-appbar-sm md:-mt-appbar-md relative aspect-[16/9] max-h-[100svh] min-h-[320px] w-full overflow-hidden bg-page-bg'>
			<div className='absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-white/[0.02]' />
			<div className='pointer-events-none absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-black/40 to-transparent md:w-1/2' />
			<div className='pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-page-bg to-transparent' />
		</section>
	)
}
