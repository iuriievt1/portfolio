/** Tooltip shown above player control buttons on hover. */
export function Tooltip({ label, visible }: { label: string; visible: boolean }) {
	if (!visible) return null

	return (
		<div className='-translate-x-1/2 absolute bottom-full left-1/2 mb-8 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-white text-xs'>
			{label}
		</div>
	)
}
