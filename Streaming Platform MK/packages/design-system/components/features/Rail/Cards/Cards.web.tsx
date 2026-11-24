'use client'

import { cn } from '@pkg/utils'
import { RAIL } from '../../../../tokens/rail'
import { Arrows } from '../Arrows/Arrows'
import { railArrowVisibility } from '../Arrows/visibility'
import { Card, ViewAllCard } from '../Card'
import { useRailMeta } from '../hooks/use-rail'
import { useRailScroll } from '../hooks/use-rail-scroll'
import type { CardAspect, RailItemData, RailVariant, RenderCardFn, ResponsiveCols } from '../types'
import { Mask } from './Mask'

type CardsProps = {
	items: RailItemData[]
	cols?: ResponsiveCols
	renderCard?: RenderCardFn
	viewAllHref?: string
	className?: string
}

function viewAllAspect(variant: RailVariant, aspect?: CardAspect): CardAspect {
	if (aspect) return aspect
	if (variant === 'poster') return 'poster'
	if (variant === 'character') return 'square'
	return 'video'
}

export function Cards({ items, cols, renderCard, viewAllHref, className }: CardsProps) {
	const meta = useRailMeta()
	const {
		scrollerRef,
		containerRef,
		cardW,
		gap,
		isMobile,
		pagePad,
		canLeft,
		canRight,
		rightMaskW,
		leftMaskW,
		peekIndex,
		scrollByPage,
	} = useRailScroll(meta.variant, cols)

	const arrows = railArrowVisibility({ isMobile, canLeft, canRight })

	return (
		<div ref={containerRef} className={cn('relative', className)}>
			<div className='relative' style={{ marginLeft: -pagePad, marginRight: -pagePad }}>
				<div ref={scrollerRef} className='no-scrollbar overflow-x-auto overflow-y-visible'>
					<div
						className='flex'
						style={{ paddingLeft: pagePad, gap, paddingTop: RAIL.trackPadBottom, paddingBottom: RAIL.trackPadBottom }}
					>
						{items.map((item, idx) => {
							const isEdge = !isMobile && idx === peekIndex
							return renderCard ? (
								<div key={item.id} className={cn('shrink-0', isEdge && 'pointer-events-none')} style={{ width: cardW }}>
									{renderCard(item, { cardW, index: idx })}
								</div>
							) : (
								<Card
									key={item.id}
									item={item}
									index={idx}
									cardW={cardW}
									className={isEdge ? 'pointer-events-none' : undefined}
								/>
							)
						})}
						{viewAllHref && (
							<ViewAllCard href={viewAllHref} cardW={cardW} aspect={viewAllAspect(meta.variant, meta.aspect)} />
						)}
						<div className='shrink-0' style={{ width: pagePad - gap }} aria-hidden='true' />
					</div>
				</div>
				{!isMobile && <Mask side='right' width={rightMaskW} />}
				{!isMobile && <Mask side='left' width={leftMaskW} />}
			</div>

			{(arrows.left || arrows.right) && (
				<div className='pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center gap-2 pr-2'>
					{arrows.left && (
						<div className='pointer-events-auto'>
							<Arrows direction='left' onClick={() => scrollByPage(-1)} />
						</div>
					)}
					{arrows.right && (
						<div className='pointer-events-auto'>
							<Arrows direction='right' onClick={() => scrollByPage(1)} />
						</div>
					)}
				</div>
			)}
		</div>
	)
}
Cards.displayName = 'Rail.Cards'
