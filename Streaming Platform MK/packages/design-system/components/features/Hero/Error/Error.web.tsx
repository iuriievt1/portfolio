interface HeroErrorProps {
	error: Error | null
	onRetry?: () => void
}

export function HeroError({ error, onRetry }: HeroErrorProps) {
	if (!error) return null
	return (
		<div className='absolute inset-0 flex items-center justify-center bg-page-bg'>
			<p className='text-sm text-white/60'>Something went wrong</p>
			{onRetry && (
				<button type='button' onClick={onRetry} className='mt-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white'>
					Retry
				</button>
			)}
		</div>
	)
}
HeroError.displayName = 'Hero.Error'
