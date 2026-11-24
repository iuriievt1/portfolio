'use client'

import { cn } from '@pkg/utils'
import { motion } from 'framer-motion'
import { memo } from 'react'
import { Link } from 'solito/link'
import type { RailItemData } from '../types'
import { CardMetaContext } from './context'
import { CardContent } from './variants'

type CardRootProps = {
	item: RailItemData
	index: number
	cardW: number
	className?: string
	style?: React.CSSProperties
	children?: React.ReactNode
}

const hoverShadow = '0 0 0 3px #FFFFFF'

export const CardRoot = memo(function CardRoot({ item, index, cardW, className, style, children }: CardRootProps) {
	return (
		<CardMetaContext value={{ item, index }}>
			<div className='shrink-0' style={{ width: cardW, ...style }}>
				<Link href={item.href} className={cn('group block focus-visible:outline-none', className)}>
					<motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
						{children ?? <CardContent item={item} />}
					</motion.div>
				</Link>
			</div>
		</CardMetaContext>
	)
})
CardRoot.displayName = 'Rail.Card'
