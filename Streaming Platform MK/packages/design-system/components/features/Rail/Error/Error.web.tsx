interface RailErrorProps {
	error: Error | null
	onRetry?: () => void
}

export function RailError({ error, onRetry }: RailErrorProps) {
	if (!error) return null
	return (
		<div className='flex items-center justify-center py-8'>
			<p className='text-sm text-white/60'>Something went wrong</p>
			{onRetry && (
				<button type='button' onClick={onRetry} className='mt-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white'>
					Retry
				</button>
			)}
		</div>
	)
}
RailError.displayName = 'Rail.Error'
