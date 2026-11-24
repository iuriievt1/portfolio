interface RailEmptyProps {
	isEmpty: boolean
	message?: string
}

export function Empty({ isEmpty, message = 'Nothing here yet' }: RailEmptyProps) {
	if (!isEmpty) return null
	return (
		<div className='flex items-center justify-center py-8'>
			<p className='text-sm text-white/60'>{message}</p>
		</div>
	)
}
Empty.displayName = 'Rail.Empty'
