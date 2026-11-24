export function PageError({ message }: { message: string }) {
	return (
		<div className='flex min-h-[50vh] items-center justify-center'>
			<div className='text-center'>
				<p className='text-lg text-red-400'>Failed to load content</p>
				<p className='mt-2 text-sm text-white/40'>{message}</p>
			</div>
		</div>
	)
}
