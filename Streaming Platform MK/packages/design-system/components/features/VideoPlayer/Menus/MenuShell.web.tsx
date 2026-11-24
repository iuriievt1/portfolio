'use client'

import { cn } from '@pkg/utils'
import { type ReactNode, useCallback, useEffect, useRef } from 'react'

type MenuShellProps = {
	isOpen: boolean
	onClose: () => void
	/** Section heading above the divider, e.g. `Audio`. */
	title: string
	children: ReactNode
	className?: string
}

export function MenuShell({ isOpen, onClose, title, children, className }: MenuShellProps) {
	const menuRef = useRef<HTMLDivElement>(null)

	const handleClickOutside = useCallback(
		(e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose()
			}
		},
		[onClose],
	)

	useEffect(() => {
		if (!isOpen) return
		// Delay listener to avoid closing immediately from the triggering click
		const timer = setTimeout(() => {
			document.addEventListener('click', handleClickOutside)
		}, 0)
		return () => {
			clearTimeout(timer)
			document.removeEventListener('click', handleClickOutside)
		}
	}, [isOpen, handleClickOutside])

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, keyboard handled globally
		<div
			ref={menuRef}
			className={cn(
				'sm:-translate-x-1/2 absolute right-0 bottom-full z-30 mb-8 transition-all duration-150 sm:right-auto sm:left-1/2 sm:mb-12',
				// The panel is translucent, so the shadow the design puts behind its text is what keeps
				// it readable over bright video. It inherits, so it is set once here.
				'w-[200px] rounded-xl bg-black/40 p-3 [text-shadow:0_1px_1px_rgba(0,0,0,0.5)] sm:w-[275px] sm:p-5',
				isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
				className,
			)}
			onClick={(e) => e.stopPropagation()}
		>
			<div className='flex flex-col gap-[9px]'>
				<p className='text-sm text-white/50 leading-[1.58] sm:text-base'>{title}</p>
				<div className='h-px w-full bg-white/20' />
				{children}
			</div>
		</div>
	)
}
