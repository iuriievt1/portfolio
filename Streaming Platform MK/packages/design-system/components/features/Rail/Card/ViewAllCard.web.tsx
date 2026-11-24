'use client'

import { Link } from 'solito/link'
import type { CardAspect } from '../types'
import { CardFrame } from './Frame'

type ViewAllCardProps = {
	href: string
	cardW: number
	aspect: CardAspect
	label?: string
}

/** Trailing rail card that links to the rail's View All grid page. */
export function ViewAllCard({ href, cardW, aspect, label = 'View all' }: ViewAllCardProps) {
	return (
		<div className='shrink-0' style={{ width: cardW }}>
			<Link href={href} className='group block focus-visible:outline-none'>
				<CardFrame
					aspect={aspect}
					className='flex items-center justify-center bg-viewall group-focus-visible:shadow-[0_0_0_3px_#FFFFFF]'
				>
					<span className='font-semibold text-2xl text-white tracking-tight'>{label}</span>
				</CardFrame>
			</Link>
		</div>
	)
}
ViewAllCard.displayName = 'Rail.ViewAllCard'
