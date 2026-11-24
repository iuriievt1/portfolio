'use client'

import { cn } from '@pkg/utils'
import { useMemo, useState } from 'react'
import type { RailDisplay } from '../context'
import {
	RailDisplayContext,
	RailFocusContext,
	RailHoverContext,
	RailMetaContext,
	VARIANT_DISPLAY_DEFAULTS,
} from '../context'
import type { CardAspect, RailData, RailVariant } from '../types'

type RailProps = {
	id: string
	rail?: RailData
	variant?: RailVariant
	aspect?: CardAspect
	showCardTitle?: boolean
	display?: Partial<RailDisplay>
	className?: string
	children: React.ReactNode
}

export function Rail({ id, rail, variant, aspect, showCardTitle, display, className, children }: RailProps) {
	const [focusedIndex, setFocusedIndex] = useState(-1)
	const [hovered, setHovered] = useState(false)

	const resolvedVariant = variant ?? rail?.variant ?? 'backdrop'
	const resolvedAspect = aspect ?? rail?.aspect
	const resolvedShowTitle = showCardTitle ?? rail?.showCardTitle

	const resolvedDisplay = useMemo(
		() => ({ ...VARIANT_DISPLAY_DEFAULTS[resolvedVariant], ...rail?.display, ...display }),
		[resolvedVariant, rail?.display, display],
	)

	const meta = useMemo(
		() => ({ railId: id, variant: resolvedVariant, aspect: resolvedAspect, showCardTitle: resolvedShowTitle }),
		[id, resolvedVariant, resolvedAspect, resolvedShowTitle],
	)

	const focusValue = useMemo(() => ({ focusedIndex, setFocusedIndex }), [focusedIndex])
	const hoverValue = useMemo(() => ({ hovered, setHovered }), [hovered])

	if (rail && rail.items.length === 0) return null

	return (
		<RailMetaContext value={meta}>
			<RailFocusContext value={focusValue}>
				<RailHoverContext value={hoverValue}>
					<RailDisplayContext value={resolvedDisplay}>
						<section
							className={cn('space-y-3', className)}
							onMouseEnter={() => setHovered(true)}
							onMouseLeave={() => setHovered(false)}
						>
							{children}
						</section>
					</RailDisplayContext>
				</RailHoverContext>
			</RailFocusContext>
		</RailMetaContext>
	)
}
Rail.displayName = 'Rail'
