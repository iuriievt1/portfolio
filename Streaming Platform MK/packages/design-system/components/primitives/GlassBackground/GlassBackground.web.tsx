import type { HTMLAttributes, ReactNode } from 'react'
import { GLASS } from '../../../tokens/primitives'

type GlassBackgroundProps = HTMLAttributes<HTMLDivElement> & {
	children?: ReactNode
}

export function GlassBackground({ style, children, ...props }: GlassBackgroundProps) {
	return (
		<div style={{ backgroundColor: GLASS.fallbackBg, ...style }} {...props}>
			{children}
		</div>
	)
}
GlassBackground.displayName = 'GlassBackground'
