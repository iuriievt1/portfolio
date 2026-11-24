import { PALETTE, rgb } from '../../../../tokens/primitives'

type MaskProps = {
	side: 'left' | 'right'
	width: number
}

const gradients = {
	right: `linear-gradient(to left, ${rgb(PALETTE.pageBg)}, ${rgb(PALETTE.pageBg, 0)})`,
	left: `linear-gradient(to right, ${rgb(PALETTE.pageBg)}, ${rgb(PALETTE.pageBg, 0)})`,
}

export function Mask({ side, width }: MaskProps) {
	if (width <= 0) return null
	return (
		<div
			className={`pointer-events-none absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'} z-mask`}
			style={{ width, backgroundImage: gradients[side] }}
		/>
	)
}
Mask.displayName = 'Rail.Mask'
