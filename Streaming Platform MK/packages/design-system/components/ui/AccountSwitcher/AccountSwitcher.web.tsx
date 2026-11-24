'use client'

import { cn } from '@pkg/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PALETTE, rgb } from '../../../tokens'
import { AccountBadge } from '../AccountBadge'
import { EASE_OUT_EXPO } from '../AppBar/shared'
import { measureScroll, type ScrollMetrics, scrollTopForPointer } from './scrollbar'
import type { AccountSwitcherProps } from './types'

/**
 * Per design the panel grows with its content up to this many rows, then caps and
 * scrolls. A cap, not a fixed height — a shorter list must not leave an empty slot.
 */
const MAX_VISIBLE_ROWS = 7
/** Figma: row 51 tall with 8 between rows. */
const ROW_HEIGHT = 51
const ROW_GAP = 8
/**
 * Heading block above the rows. Figma trims the heading to its cap height
 * ("H Hug 11px") and leaves 7 before the first row.
 */
const HEADING_TEXT_HEIGHT = 11
const HEADING_GAP = 7
const HEADING_BLOCK_HEIGHT = HEADING_TEXT_HEIGHT + HEADING_GAP
/** Gap between the avatar button and the panel. */
const ANCHOR_OFFSET = 12

/**
 * Two nested containers per Figma. Outer `Account Dropdown` 405, padding 10, radius 8,
 * fill #000000 at 50%. Inner `DropDown` card 385, padding 16, gap 8, radius 8,
 * fill #0C2150 at 90% — the navy is this card, not the hero showing through.
 */
const PANEL_WIDTH = 405
/** Smallest gap the panel keeps from the viewport edge once it stops fitting. */
const VIEWPORT_MARGIN = 8
const PANEL_STYLE = {
	// Narrow phones are below the design width, so the panel shrinks rather than
	// hanging off-screen with its rows unreachable.
	width: `min(${PANEL_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
	backgroundColor: rgb(PALETTE.black, 0.5),
} as const

const CARD_STYLE = {
	backgroundColor: rgb(PALETTE.switcherCard, 0.9),
} as const

/**
 * Opening the switcher dims and blurs the whole viewport, per the Figma frame
 * (1280×911, `background: rgba(0,0,0,0.60); backdrop-filter: blur(2px)`).
 */
const SCRIM_STYLE = {
	backgroundColor: rgb(PALETTE.black, 0.6),
	backdropFilter: 'blur(2px)',
	WebkitBackdropFilter: 'blur(2px)',
} as const

/** Figma: 22.5 · 162 · 8 divider 8 · 162 · 22.5. Accounts takes the rest and lands on 162 too. */
const STORES_COLUMN_WIDTH = 162

/** Figma: 38×38 circle, same for both columns and both states. */
const BADGE_SIZE_CLASS = 'h-[38px] w-[38px]'

/** Card padding and the gap between the two columns, per Figma. */
const CARD_PADDING = 16
const COLUMN_GAP = 8

/** Placeholder rows for a column whose list has not arrived yet — keeps the layout still. */
const LOADING_PLACEHOLDER_ROWS = 2

/**
 * Figma draws its own scrollbar (`Scroll Bar`): a 5-wide track inset 8 from the card's
 * right edge, spanning the card's content height, #FFFFFF at 20%, with a solid white
 * thumb. The native bar is hidden — this one overlays the card padding, so it never
 * steals width from the rows.
 */
const SCROLLBAR_WIDTH = 5
const SCROLLBAR_RIGHT = 8

/** Figma leaves 9.5 between a row's right edge and the bar. */
const SCROLLBAR_GUTTER = 9.5

/**
 * A 5-wide bar is too thin to grab, so the pointer target is widened into the card
 * padding either side. Still clears the rows, which stop SCROLLBAR_GUTTER short.
 */
const SCROLLBAR_HIT_PADDING = 5

/**
 * Rows stop short of the card padding on both sides — on the right to clear the
 * scrollbar, on the left to mirror it. 16 + 6.5 is the 22.5 Figma measures from the
 * card edge to a row.
 */
const COLUMN_INSET = SCROLLBAR_RIGHT + SCROLLBAR_WIDTH + SCROLLBAR_GUTTER - CARD_PADDING

/**
 * Right-aligns the panel to its trigger, but never past the point where the panel
 * would hang off the left edge — on a phone the trigger sits close to that edge.
 */
function panelRight(anchorRect: { right: number } | null): number {
	if (!anchorRect) return VIEWPORT_MARGIN
	const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
	const maxRight = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)
	return Math.min(maxRight, Math.max(window.innerWidth - anchorRect.right, VIEWPORT_MARGIN))
}

export function AccountSwitcher({
	open,
	sections,
	switchingId = null,
	anchorRect = null,
	onSelect,
	onClose,
	className,
}: AccountSwitcherProps) {
	const panelRef = useRef<HTMLDivElement>(null)
	const scrollRef = useRef<HTMLDivElement>(null)
	const trackRef = useRef<HTMLSpanElement>(null)
	const isSwitching = switchingId != null

	/** Drives the custom scrollbar: whether it is needed, how tall, and how far down. */
	const [scroll, setScroll] = useState<ScrollMetrics>({ overflows: false, ratio: 1, progress: 0 })
	/** Per Figma the bar only lights up under the pointer; dragging counts as under it. */
	const [barHot, setBarHot] = useState(false)
	const [dragging, setDragging] = useState(false)

	// The AppBar clips its children (overflow-hidden for the search morph), so the
	// panel lives in a portal and anchors itself to the trigger in viewport coords.
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])

	// Listens on the document, not the panel: the trigger lives outside this
	// portal, so focus is not inside the panel when it opens.
	useEffect(() => {
		if (!open) return

		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose()
				return
			}
			if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
			e.preventDefault()

			const rows = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('[data-account-row]') ?? [])
			if (rows.length === 0) return

			const focused = document.activeElement
			const current = focused instanceof HTMLButtonElement ? rows.indexOf(focused) : -1
			const step = e.key === 'ArrowDown' ? 1 : -1
			const next = current < 0 ? (step === 1 ? 0 : rows.length - 1) : (current + step + rows.length) % rows.length
			rows[next]?.focus()
		}

		document.addEventListener('keydown', handleKey)
		return () => document.removeEventListener('keydown', handleKey)
	}, [open, onClose])

	// biome-ignore lint/correctness/useExhaustiveDependencies: sections re-attaches the observers to the new row wrappers
	useEffect(() => {
		const el = scrollRef.current
		if (!open || !el) return

		const update = () => setScroll(measureScroll(el))

		update()
		el.addEventListener('scroll', update, { passive: true })
		// Rows arrive (and vanish) from the API while the panel is already open. The
		// region itself is capped and its columns stretch to it, so neither of them
		// resizes — only the row wrappers do, which is what has to be observed.
		const observer = new ResizeObserver(update)
		observer.observe(el)
		for (const rows of Array.from(el.querySelectorAll('[data-account-rows]'))) observer.observe(rows)

		return () => {
			el.removeEventListener('scroll', update)
			observer.disconnect()
		}
	}, [open, sections])

	const scrollToPointer = useCallback(
		(clientY: number, grabOffset: number) => {
			const el = scrollRef.current
			const track = trackRef.current
			if (!el || !track) return

			const rect = track.getBoundingClientRect()
			el.scrollTop = scrollTopForPointer({
				pointerY: clientY,
				trackTop: rect.top,
				trackHeight: rect.height,
				ratio: scroll.ratio,
				scrollHeight: el.scrollHeight,
				clientHeight: el.clientHeight,
				grabOffset,
			})
		},
		[scroll.ratio],
	)

	const handleBarPointerDown = useCallback(
		(e: React.PointerEvent<HTMLSpanElement>) => {
			const track = trackRef.current
			if (!track) return
			e.preventDefault()

			const rect = track.getBoundingClientRect()
			const thumbTop = rect.top + scroll.progress * (1 - scroll.ratio) * rect.height
			const thumbHeight = scroll.ratio * rect.height
			// Grabbing the thumb keeps it under the cursor; clicking the bare track
			// centres it on the click first, then drags from there.
			const onThumb = e.clientY >= thumbTop && e.clientY <= thumbTop + thumbHeight
			const grabOffset = onThumb ? e.clientY - thumbTop : thumbHeight / 2

			e.currentTarget.setPointerCapture(e.pointerId)
			setDragging(true)
			scrollToPointer(e.clientY, grabOffset)

			const move = (ev: PointerEvent) => scrollToPointer(ev.clientY, grabOffset)
			const end = () => {
				setDragging(false)
				document.removeEventListener('pointermove', move)
				document.removeEventListener('pointerup', end)
				document.removeEventListener('pointercancel', end)
			}
			document.addEventListener('pointermove', move)
			document.addEventListener('pointerup', end)
			document.addEventListener('pointercancel', end)
		},
		[scroll.progress, scroll.ratio, scrollToPointer],
	)

	if (!mounted) return null

	const visibleSections = sections.filter((section) => section.items.length > 0 || section.loading)

	const panel = (
		<AnimatePresence>
			{open && (
				<motion.div
					key='scrim'
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
					style={SCRIM_STYLE}
					// Below the AppBar (z-50) so the trigger stays crisp and clickable.
					className='fixed inset-0 z-[45]'
					onClick={onClose}
					role='presentation'
				/>
			)}
			{open && (
				<motion.div
					key='panel'
					ref={panelRef}
					initial={{ opacity: 0, y: -6, scale: 0.97 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -6, scale: 0.97 }}
					transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
					style={{
						...PANEL_STYLE,
						top: (anchorRect?.bottom ?? 0) + ANCHOR_OFFSET,
						right: panelRight(anchorRect),
					}}
					data-account-panel
					className={cn('fixed z-[70] flex origin-top-right flex-col gap-[10px] rounded-[8px] p-[10px]', className)}
					role='menu'
					aria-label='Stores and accounts'
					aria-busy={isSwitching}
				>
					<div style={CARD_STYLE} className='relative flex w-full flex-col rounded-[8px] p-[16px]'>
						{/*
						 * The divider spans the card's whole content height (Figma: 422 tall) and
						 * must not live inside the scroll region, or it scrolls away with the rows.
						 */}
						{visibleSections.length > 1 && (
							<span
								aria-hidden='true'
								className='absolute w-px bg-white/20'
								style={{
									left: CARD_PADDING + COLUMN_INSET + STORES_COLUMN_WIDTH + COLUMN_GAP,
									top: CARD_PADDING,
									bottom: CARD_PADDING,
								}}
							/>
						)}
						{/*
						 * Figma's own scrollbar, spanning the same content height as the divider.
						 * It sits in the card's right padding, so it overlays nothing.
						 */}
						{scroll.overflows && (
							// The hit area is wider than the bar so it can be grabbed; the visible
							// track and thumb sit centred inside it.
							<span
								aria-hidden='true'
								onPointerDown={handleBarPointerDown}
								onPointerEnter={() => setBarHot(true)}
								onPointerLeave={() => setBarHot(false)}
								className='absolute flex cursor-pointer touch-none justify-center'
								style={{
									width: SCROLLBAR_WIDTH + SCROLLBAR_HIT_PADDING * 2,
									right: SCROLLBAR_RIGHT - SCROLLBAR_HIT_PADDING,
									top: CARD_PADDING,
									bottom: CARD_PADDING,
								}}
							>
								<span ref={trackRef} className='relative h-full bg-white/20' style={{ width: SCROLLBAR_WIDTH }}>
									{/* Figma: the thumb rests at white 60% over the track and goes solid (#FFF) under the pointer. */}
									<span
										className={cn(
											'absolute inset-x-0 transition-colors',
											barHot || dragging ? 'bg-white' : 'bg-white/60',
										)}
										style={{
											height: `${scroll.ratio * 100}%`,
											top: `${scroll.progress * (1 - scroll.ratio) * 100}%`,
										}}
									/>
								</span>
							</span>
						)}
						{/*
						 * Headings sit outside the scroll region: both columns scroll together in
						 * one region with a single scrollbar, and nothing bleeds through the
						 * headings the way a translucent sticky row would.
						 */}
						<div className='flex shrink-0 gap-[8px]' style={{ paddingLeft: COLUMN_INSET, paddingRight: COLUMN_INSET }}>
							{visibleSections.map((section, sectionIndex) => (
								<div
									key={section.title}
									style={{
										height: HEADING_BLOCK_HEIGHT,
										...(section.variant === 'stores' ? { width: STORES_COLUMN_WIDTH } : {}),
									}}
									className={cn(
										section.variant === 'stores' ? 'shrink-0' : 'min-w-0 flex-1',
										sectionIndex > 0 && 'pl-[8px]',
									)}
								>
									{/*
									 * Figma: Proxima Nova 14 / 400 / #FFF, trimmed to cap height. The tight
									 * line-height reproduces that trim so the 6 below is real breathing room
									 * rather than the font's own leading.
									 */}
									<p
										style={{ height: HEADING_TEXT_HEIGHT, lineHeight: `${HEADING_TEXT_HEIGHT}px` }}
										className='pl-0.5 font-normal text-[14px] text-white'
									>
										{section.title}
									</p>
								</div>
							))}
						</div>

						<div
							ref={scrollRef}
							// Native bar hidden — the design's own is drawn above.
							className='flex items-stretch gap-[8px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
							style={{
								paddingLeft: COLUMN_INSET,
								paddingRight: COLUMN_INSET,
								// A cap, so a list shorter than the cap ends with its last row rather
								// than an empty slot — and never reports overflow it does not have.
								maxHeight: MAX_VISIBLE_ROWS * ROW_HEIGHT + (MAX_VISIBLE_ROWS - 1) * ROW_GAP,
							}}
						>
							{visibleSections.map((section, sectionIndex) => (
								<div
									key={section.title}
									style={section.variant === 'stores' ? { width: STORES_COLUMN_WIDTH } : undefined}
									className={cn(
										'flex flex-col',
										section.variant === 'stores' ? 'shrink-0' : 'min-w-0 flex-1',
										sectionIndex > 0 && 'pl-[8px]',
									)}
								>
									<div data-account-rows className='flex flex-col' style={{ gap: ROW_GAP }}>
										{section.items.length === 0 &&
											section.loading &&
											Array.from({ length: LOADING_PLACEHOLDER_ROWS }, (_, i) => (
												<div
													key={`placeholder-${section.title}-${i}`}
													aria-hidden='true'
													style={{ height: ROW_HEIGHT }}
													className='flex shrink-0 items-center gap-[6px] p-[6px]'
												>
													<span className={cn(BADGE_SIZE_CLASS, 'shrink-0 rounded-full border border-white/15')} />
													<span className='h-3 flex-1 animate-pulse rounded-full bg-white/10' />
												</div>
											))}
										{section.items.map((item, index) => {
											const isActive = item.id === section.activeId
											const isRowSwitching = item.id === switchingId
											const badgeLabel = section.variant === 'stores' ? `#${index + 1}` : item.initials

											return (
												<button
													key={item.id}
													type='button'
													data-account-row
													role='menuitemradio'
													aria-checked={isActive}
													aria-label={
														item.unresolved ? `${item.name} — unavailable, token expired` : item.name || 'Loading'
													}
													disabled={isSwitching}
													onClick={() => onSelect(item.id)}
													className={cn(
														// Figma: 51 tall, gap 6, radius 8, hover #FFFFFF at 20%. No padding right —
														// the name runs to the row edge, which is where the 162 comes from.
														'flex shrink-0 items-center gap-[6px] rounded-[8px] py-[6px] pl-[6px] text-left transition-colors',
														!isSwitching && 'hover:bg-white/20',
														'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40',
														isSwitching && !isRowSwitching && 'opacity-40',
													)}
													style={{ height: ROW_HEIGHT }}
												>
													<AccountBadge
														className={BADGE_SIZE_CLASS}
														label={badgeLabel}
														isActive={isActive}
														dimmed={item.unresolved}
														// Only accounts carry a picture, and only the ones configured with one —
														// per Figma it stays with its account even when another row is active.
														avatarUrl={section.variant === 'accounts' ? item.avatarUrl : undefined}
													/>
													{item.name ? (
														<span
															className={cn(
																// Figma: Proxima Nova 16 / 400 — #FFF active, #AFAFAF otherwise.
																'min-w-0 flex-1 truncate font-normal text-[16px] transition-colors',
																isActive ? 'text-white' : 'text-switcher-muted',
																item.unresolved && 'text-white/30 italic',
															)}
														>
															{item.name}
														</span>
													) : (
														<span className='h-3 flex-1 animate-pulse rounded-full bg-white/10' aria-hidden='true' />
													)}
												</button>
											)
										})}
									</div>
								</div>
							))}
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)

	return createPortal(panel, document.body)
}
AccountSwitcher.displayName = 'AccountSwitcher'
