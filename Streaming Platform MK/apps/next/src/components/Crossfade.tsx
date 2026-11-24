'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

type CrossfadeProps = {
	loading: boolean
	skeleton: ReactNode
	children: ReactNode
	enterY?: number
	enterDuration?: number
	exitDuration?: number
	delay?: number
}

export function Crossfade({
	loading,
	skeleton,
	children,
	enterY = 4,
	enterDuration = 0.2,
	exitDuration = 0.15,
	delay = 0,
}: CrossfadeProps) {
	const reduced = useReducedMotion()
	const y = reduced ? 0 : enterY
	const dur = (d: number) => (reduced ? 0 : d)

	return (
		<AnimatePresence mode='wait' initial={false}>
			{loading ? (
				<motion.div key='skeleton' exit={{ opacity: 0 }} transition={{ duration: dur(exitDuration) }}>
					{skeleton}
				</motion.div>
			) : (
				<motion.div
					key='content'
					initial={{ opacity: 0, y }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: dur(enterDuration), ease: 'easeOut', delay }}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}
