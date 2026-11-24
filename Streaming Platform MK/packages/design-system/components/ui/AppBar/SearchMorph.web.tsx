'use client'

import { cn } from '@pkg/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'
import { SIZING } from '../../../tokens/primitives'
import { CloseIcon } from '../../primitives/icons/Close'
import { SearchIcon } from '../../primitives/icons/Search'
import { useAppBar } from './appbar-context'
import { SEARCH_ICON_SIZE as ICON_SIZE } from './search-layout'
import { BLUR_TRANSITION } from './shared'
import { usePreferredPillWidth } from './use-preferred-pill-width'

type SearchMorphProps = {
	open: boolean
	onToggle: () => void
	className?: string
}

export function SearchMorph({ open, onToggle, className }: SearchMorphProps) {
	const reducedMotion = useReducedMotion()
	const inputRef = useRef<HTMLInputElement>(null)
	const { searchPillWidth } = useAppBar()
	const preferredWidth = usePreferredPillWidth()
	// The app bar measures the space actually left beside the nav; fall back to the
	// viewport-based width until it has (or when rendered outside an AppBar).
	const pillWidth = searchPillWidth ?? preferredWidth

	useEffect(() => {
		if (open) {
			const id = setTimeout(() => inputRef.current?.focus(), 200)
			return () => clearTimeout(id)
		}
		// Clear input when closing
		if (inputRef.current) inputRef.current.value = ''
	}, [open])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Escape') onToggle()
		},
		[onToggle],
	)

	/* -- Shared pill content ------------------------------------------------*/
	const pillContent = (
		<>
			<SearchIcon className='h-4 w-4 shrink-0 text-white/50' />
			<input
				ref={inputRef}
				type='text'
				placeholder='Search...'
				tabIndex={open ? 0 : -1}
				onKeyDown={handleKeyDown}
				className='min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none'
			/>
			<motion.button
				type='button'
				aria-label='Close search'
				onClick={onToggle}
				tabIndex={open ? 0 : -1}
				initial={{ opacity: 0 }}
				animate={{ opacity: open ? 1 : 0 }}
				transition={{ duration: 0.15, delay: open ? 0.2 : 0 }}
				className='shrink-0 text-white/60 hover:text-white'
			>
				<CloseIcon className='h-4 w-4' />
			</motion.button>
		</>
	)

	/* -- Reduced motion -----------------------------------------------------*/
	if (reducedMotion) {
		return (
			<div className={cn('relative', className)}>
				{!open && (
					<button
						type='button'
						aria-label='Open search'
						onClick={onToggle}
						className='inline-flex h-9 w-9 items-center justify-center text-white/70 transition-colors hover:text-white'
					>
						<SearchIcon className='h-5 w-5' />
					</button>
				)}
				{open && (
					<div className='flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5'>
						{pillContent}
					</div>
				)}
			</div>
		)
	}

	/* -- Full animation — blur-in materialise --------------------------------*/

	return (
		<div className={cn('relative', className)} style={{ minWidth: ICON_SIZE, height: ICON_SIZE }}>
			<AnimatePresence>
				{open && (
					<>
						{/* Desktop pill */}
						<motion.div
							key='desktop-pill'
							initial={{ opacity: 0, filter: 'blur(12px)' }}
							animate={{ opacity: 1, filter: 'blur(0px)' }}
							exit={{ opacity: 0, filter: 'blur(12px)' }}
							transition={BLUR_TRANSITION}
							className='absolute inset-y-0 right-0 hidden overflow-hidden rounded-full border border-white/30 bg-white/[0.08] sm:block'
							style={{ height: ICON_SIZE, width: pillWidth }}
						>
							<div className='absolute inset-0 flex items-center gap-2 px-3'>{pillContent}</div>
						</motion.div>

						{/* Mobile pill — fixed to appbar padding edges */}
						<motion.div
							key='mobile-pill'
							initial={{ opacity: 0, filter: 'blur(12px)' }}
							animate={{ opacity: 1, filter: 'blur(0px)' }}
							exit={{ opacity: 0, filter: 'blur(12px)' }}
							transition={BLUR_TRANSITION}
							className='fixed right-5 left-[120px] overflow-hidden rounded-full border border-white/30 bg-white/[0.08] sm:hidden'
							style={{ height: ICON_SIZE, top: (SIZING.appbar.sm - ICON_SIZE) / 2 }}
						>
							<div className='flex h-full items-center gap-2 px-3'>{pillContent}</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			{/* Idle search icon — visible when closed */}
			<button
				type='button'
				aria-label='Open search'
				onClick={onToggle}
				className={cn(
					'absolute top-0 right-0 inline-flex items-center justify-center text-white/70 transition-colors hover:text-white',
					open && 'pointer-events-none opacity-0',
				)}
				style={{ width: ICON_SIZE, height: ICON_SIZE }}
			>
				{!open && <SearchIcon className='h-5 w-5' />}
			</button>
		</div>
	)
}
SearchMorph.displayName = 'SearchMorph'
