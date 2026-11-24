'use client'

import { cn } from '@pkg/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PALETTE, rgb } from '../../../tokens'
import { Avatar } from '../../primitives/Avatar'
import { SettingsIcon } from '../../primitives/icons/Settings'
import { Link } from '../../primitives/Link'
import { AccountBadge } from '../AccountBadge'
import { type AppBarAccountSummary, type AppBarAnchorRect, AppBarContext, NO_ACCOUNT } from './appbar-context'
import { shouldCollapseNav } from './nav-layout'
import { resolveSearchLayout, SEARCH_ICON_SIZE, type SearchLayout } from './search-layout'
import { EASE_OUT_EXPO, GLASS_MATERIAL, NARROW_MQ, NAV_BREAKPOINT, SCRIM_STYLE, useMediaQuery } from './shared'
import type { AppBarItem, AppBarProps } from './types'
import { usePreferredPillWidth } from './use-preferred-pill-width'

const SCROLL_RESET_DELAY_MS = 500
const HAMBURGER_MQ = `(min-width: ${NAV_BREAKPOINT}px)`

// IMPORTANT: These must be full static strings — Tailwind JIT cannot resolve template literals.
// If NAV_BREAKPOINT changes, update these classes manually.
const NAV_SHOW = '[@media(min-width:450px)]:block hidden'
const NAV_HIDE = '[@media(min-width:450px)]:hidden'
const NAV_GAP = '[@media(min-width:450px)]:gap-[30px]'

function MenuButton({ open, onToggle, forced }: { open: boolean; onToggle: () => void; forced?: boolean }) {
	return (
		<button
			type='button'
			aria-label={open ? 'Close menu' : 'Open menu'}
			aria-expanded={open}
			onClick={onToggle}
			className={cn('relative z-[60] flex h-10 w-10 items-center justify-center', !forced && NAV_HIDE)}
		>
			<div className='flex h-5 w-6 flex-col justify-between'>
				<span
					className={cn(
						'block h-[2px] w-full rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
						open && 'translate-y-[9px] rotate-45',
					)}
				/>
				<span
					className={cn(
						'block h-[2px] w-full rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
						open ? 'scale-x-0 opacity-0' : 'opacity-100',
					)}
				/>
				<span
					className={cn(
						'block h-[2px] w-full rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
						open && '-translate-y-[9px] -rotate-45',
					)}
				/>
			</div>
		</button>
	)
}

// ---------------------------------------------------------------------------
// MobileSidebar — slides in from left, only below xs breakpoint
// ---------------------------------------------------------------------------

function MobileSidebar({
	open,
	items,
	avatarUrl,
	checkActive,
	onClose,
	account,
	onOpenAccountMenu,
	forced,
}: {
	open: boolean
	items: AppBarItem[]
	avatarUrl?: string
	checkActive: (href: string) => boolean
	onClose: () => void
	/** The signed-in account, so this card shows what the app bar trigger shows. */
	account: AppBarAccountSummary
	/** Set only when there is more than one account or store to switch between. */
	onOpenAccountMenu?: () => void
	/** The nav collapsed on measurement, so the sidebar is in play above the breakpoint too. */
	forced?: boolean
}) {
	useEffect(() => {
		document.body.style.overflow = open ? 'hidden' : ''
		return () => {
			document.body.style.overflow = ''
		}
	}, [open])

	useEffect(() => {
		if (!open) return
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', handleKey)
		return () => document.removeEventListener('keydown', handleKey)
	}, [open, onClose])

	return (
		<AnimatePresence>
			{open && (
				<div className={cn('fixed inset-x-0 top-appbar-sm bottom-0 z-40 md:top-appbar-md', !forced && NAV_HIDE)}>
					{/* Scrim */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
						className='absolute inset-0'
						style={SCRIM_STYLE}
						onClick={onClose}
						role='presentation'
					/>
					{/* Scrim extension behind appbar */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
						className='fixed inset-x-0 top-0 h-appbar-sm md:h-appbar-md'
						style={SCRIM_STYLE}
					/>

					{/* Floating glass panel — scale-in materialise (GPU-composited) */}
					<motion.nav
						initial={{ opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.96 }}
						transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
						className='absolute top-1.5 right-2.5 bottom-1.5 left-2.5 flex flex-col overflow-hidden rounded-[14px]'
						style={GLASS_MATERIAL}
					>
						{/* Nav items */}
						<div className='relative z-20 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-3'>
							{items.map((item, i) => {
								const active = checkActive(item.href)
								return (
									<motion.div
										key={item.href}
										initial={{ opacity: 0, x: -8 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: 0.1 + i * 0.04, duration: 0.35, ease: EASE_OUT_EXPO }}
									>
										<Link
											href={item.href}
											onClick={onClose}
											className={cn(
												'relative block overflow-hidden rounded-2xl px-3.5 py-3 font-medium text-[15px] tracking-tight transition-all',
												active ? 'text-white' : 'text-white/55 hover:text-white/80',
												!active && 'hover:bg-white/[0.06]',
											)}
											style={active ? { background: rgb(PALETTE.white, 0.06) } : undefined}
											aria-current={active ? 'page' : undefined}
										>
											<span className='relative z-10'>{item.label}</span>
										</Link>
									</motion.div>
								)
							})}
						</div>

						{/* User card */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.3, duration: 0.4 }}
							className='relative z-20 p-3'
						>
							<button
								type='button'
								aria-label={onOpenAccountMenu ? 'Switch account or store' : 'User settings'}
								aria-haspopup={onOpenAccountMenu ? 'menu' : undefined}
								onClick={onOpenAccountMenu}
								className='hover:-translate-y-px relative flex w-full items-center gap-3 overflow-hidden rounded-[18px] px-3.5 py-3 transition-all'
								style={{
									background: rgb(PALETTE.white, 0.05),
								}}
							>
								{account.initials || account.avatarUrl ? (
									<AccountBadge
										label={account.initials ?? ''}
										avatarUrl={account.avatarUrl}
										dimmed={account.unresolved}
										className='h-9 w-9'
									/>
								) : (
									<Avatar src={avatarUrl} />
								)}
								<span
									className={cn(
										'relative z-10 flex-1 truncate text-left font-semibold text-sm text-white/95',
										account.unresolved && 'text-white/40 italic',
									)}
								>
									{account.name || 'User'}
								</span>
								<SettingsIcon className='relative z-10 h-5 w-5 text-white/35' />
							</button>
						</motion.div>
					</motion.nav>
				</div>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------------------
// AppBar
// Desktop (≥xs): logo + nav + search + avatar in one row
// Mobile  (<xs): logo + search + avatar + hamburger, nav in sidebar
// ---------------------------------------------------------------------------

export function AppBar({
	brand = { label: 'MK.io', href: '/' },
	items = [],
	right,
	className,
	isActive,
	avatarUrl,
	pathname,
}: AppBarProps) {
	const checkActive = isActive ?? (() => false)
	const [searchOpen, setSearchOpen] = useState(false)
	const [mobileOpen, setMobileOpen] = useState(false)
	const [accountMenuOpen, setAccountMenuOpen] = useState(false)
	const [accountMenuAnchor, setAccountMenuAnchor] = useState<AppBarAnchorRect | null>(null)
	const [account, setAccount] = useState<AppBarAccountSummary>(NO_ACCOUNT)
	const isNarrow = useMediaQuery(NARROW_MQ)
	const headerRef = useRef<HTMLElement>(null)
	const rowRef = useRef<HTMLDivElement>(null)
	const navRef = useRef<HTMLElement>(null)
	const spacerRef = useRef<HTMLDivElement>(null)
	const logoRef = useRef<HTMLDivElement>(null)
	const rightRef = useRef<HTMLDivElement>(null)
	const [navCollapsed, setNavCollapsed] = useState(false)
	const preferredPillWidth = usePreferredPillWidth()
	const [searchLayout, setSearchLayout] = useState<SearchLayout>({ pillWidth: preferredPillWidth, hideNav: false })

	// The expanded pill is right-anchored and grows leftwards across the spacer, so its
	// ceiling is the free space beside the nav — not the viewport (#78).
	const measureSearchLayout = useCallback(() => {
		const row = rowRef.current
		const spacer = spacerRef.current
		if (!row || !spacer) return
		const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0
		const freeWithNav = spacer.getBoundingClientRect().width + gap + SEARCH_ICON_SIZE
		const nav = navRef.current
		const navWidth = nav ? nav.getBoundingClientRect().width + gap : 0
		setSearchLayout(resolveSearchLayout({ freeWithNav, navWidth, preferred: preferredPillWidth }))
	}, [preferredPillWidth])

	// Only measure at rest: once search is open the nav may be hidden, and measuring that
	// state would feed the freed space straight back into the decision that hid it.
	useEffect(() => {
		if (searchOpen) return
		const row = rowRef.current
		const spacer = spacerRef.current
		if (!row || !spacer) return
		measureSearchLayout()
		// The spacer is what actually shrinks as nav items arrive or the viewport changes;
		// the row keeps its width throughout, so observing it alone would miss both.
		const observer = new ResizeObserver(measureSearchLayout)
		observer.observe(row)
		observer.observe(spacer)
		return () => observer.disconnect()
	}, [searchOpen, measureSearchLayout])

	// Whether the inline nav fits is a question about label widths, not viewport width, so it
	// is measured rather than left to a breakpoint. The nav stays in the DOM while collapsed
	// (out of flow, hidden) so its natural width keeps feeding this decision.
	const measureNavLayout = useCallback(() => {
		const row = rowRef.current
		const nav = navRef.current
		// Open search unmounts the nav on narrow viewports; measuring that would read 0 and
		// undo the collapse. Hold the last decision until the nav is back.
		if (!row || !nav) return
		const style = getComputedStyle(row)
		const gap = Number.parseFloat(style.columnGap) || 0
		const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0)
		setNavCollapsed(
			shouldCollapseNav({
				available: row.getBoundingClientRect().width - padding,
				logoWidth: logoRef.current?.getBoundingClientRect().width ?? 0,
				navWidth: Math.max(nav.getBoundingClientRect().width, nav.scrollWidth),
				rightWidth: rightRef.current?.getBoundingClientRect().width ?? 0,
				gap,
			}),
		)
	}, [])

	// Re-attaches when the nav mounts — its items arrive with the page data, after first paint.
	// biome-ignore lint/correctness/useExhaustiveDependencies: items.length remounts the nav, which the observer must pick up
	useEffect(() => {
		const row = rowRef.current
		if (!row) return
		measureNavLayout()
		const observer = new ResizeObserver(measureNavLayout)
		observer.observe(row)
		if (navRef.current) observer.observe(navRef.current)
		if (rightRef.current) observer.observe(rightRef.current)
		return () => observer.disconnect()
	}, [measureNavLayout, items.length])

	const closeSearch = useCallback(() => {
		setSearchOpen(false)
	}, [])

	const closeAccountMenu = useCallback(() => {
		setAccountMenuOpen(false)
	}, [])

	const toggleAccountMenu = useCallback((anchor: AppBarAnchorRect | null) => {
		if (anchor) setAccountMenuAnchor(anchor)
		setAccountMenuOpen((prev) => !prev)
	}, [])

	// Below the nav breakpoint the panel is opened from the sidebar's user card. The
	// sidebar covers the viewport, so it gets out of the way and the panel drops from
	// under the app bar instead of from a card at the bottom of the screen.
	const openAccountMenuFromSidebar = useCallback(() => {
		const rect = headerRef.current?.getBoundingClientRect()
		setMobileOpen(false)
		setAccountMenuAnchor(rect ? { bottom: rect.bottom, right: rect.right - 20 } : null)
		setAccountMenuOpen(true)
	}, [])

	const scrollingToTopRef = useRef(false)
	const toggleSearch = useCallback(() => {
		setSearchOpen((prev) => {
			if (!prev && window.scrollY > 0) {
				scrollingToTopRef.current = true
				window.scrollTo({ top: 0, behavior: 'smooth' })
				setTimeout(() => {
					scrollingToTopRef.current = false
				}, SCROLL_RESET_DELAY_MS)
			}
			return !prev
		})
		setMobileOpen(false)
	}, [])

	const toggleMobile = useCallback(() => {
		setMobileOpen((prev) => !prev)
		setSearchOpen(false)
		setAccountMenuOpen(false)
	}, [])

	const closeMobile = useCallback(() => {
		setMobileOpen(false)
	}, [])

	useEffect(() => {
		const mq = window.matchMedia(HAMBURGER_MQ)
		const handler = () => {
			if (mq.matches) {
				setMobileOpen(false)
				setSearchOpen(false)
			}
		}
		mq.addEventListener('change', handler)
		return () => mq.removeEventListener('change', handler)
	}, [])

	useEffect(() => {
		if (!searchOpen) return
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeSearch()
		}
		document.addEventListener('keydown', handleKey)
		return () => document.removeEventListener('keydown', handleKey)
	}, [searchOpen, closeSearch])

	// Close search on scroll (skip programmatic scroll-to-top)
	useEffect(() => {
		if (!searchOpen) return
		const handleScroll = () => {
			if (scrollingToTopRef.current) return
			closeSearch()
		}
		window.addEventListener('scroll', handleScroll, { passive: true })
		return () => window.removeEventListener('scroll', handleScroll)
	}, [searchOpen, closeSearch])

	// Close search on click outside the header
	useEffect(() => {
		if (!searchOpen) return
		const handleClick = (e: MouseEvent) => {
			if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
				closeSearch()
			}
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [searchOpen, closeSearch])

	// Close search on route change
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers the effect intentionally
	useEffect(() => {
		closeSearch()
	}, [pathname, closeSearch])

	return (
		<AppBarContext
			value={{
				searchOpen,
				toggleSearch,
				closeSearch,
				avatarUrl,
				accountMenuOpen,
				accountMenuAnchor,
				account,
				setAccount,
				toggleAccountMenu,
				setAccountMenuAnchor,
				closeAccountMenu,
				searchPillWidth: searchLayout.pillWidth,
			}}
		>
			<header ref={headerRef} className={cn('relative z-50', className)}>
				{/* Appbar floating glass — matches sidebar material when drawer is open */}
				<AnimatePresence>
					{mobileOpen && (
						<motion.div
							initial={{ opacity: 0, scale: 0.98 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.98 }}
							transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
							className={cn(
								'absolute inset-x-2.5 top-1.5 bottom-1.5 overflow-hidden rounded-[14px]',
								!navCollapsed && NAV_HIDE,
							)}
							style={GLASS_MATERIAL}
						/>
					)}
				</AnimatePresence>
				<div
					ref={rowRef}
					className={cn(
						'relative mx-auto flex items-center gap-4 overflow-hidden',
						NAV_GAP,
						'h-appbar-sm px-5 md:h-appbar-md',
						'lg:px-[var(--page-pad-lg)]',
						'xl:px-[var(--page-pad-xl)]',
						'3xl:px-[var(--page-pad-3xl)]',
					)}
				>
					{/* Logo */}
					<div ref={logoRef} className='flex shrink-0'>
						<Link
							href={brand.href ?? '/'}
							className='flex shrink-0 items-center gap-2 text-white'
							aria-label={brand.label}
						>
							{brand.logo ? (
								<span className='block'>{brand.logo}</span>
							) : (
								<span className='whitespace-nowrap font-semibold text-base tracking-tight sm:text-lg'>
									{brand.label}
								</span>
							)}
						</Link>
					</div>

					{/* Nav items — hidden below nav breakpoint, or when open search needs their room */}
					{items.length > 0 && !(searchOpen && (isNarrow || searchLayout.hideNav)) && (
						<nav
							ref={navRef}
							className={cn(NAV_SHOW, navCollapsed && 'pointer-events-none invisible absolute')}
							aria-hidden={navCollapsed || undefined}
						>
							<ul className='flex items-center gap-x-[30px]'>
								{items.map((item) => {
									const active = checkActive(item.href)
									return (
										<li key={item.href}>
											<Link
												href={item.href}
												className={cn(
													'whitespace-nowrap font-medium tracking-tight transition-colors',
													'text-sm sm:text-base lg:text-lg',
													active ? '!text-white font-semibold' : 'text-muted hover:text-white/90',
												)}
												aria-current={active ? 'page' : undefined}
											>
												{item.label}
											</Link>
										</li>
									)
								})}
							</ul>
						</nav>
					)}

					<div ref={spacerRef} className='flex-1' />

					{/* Right side: search + avatar + hamburger */}
					<div ref={rightRef} className='flex shrink-0 items-center gap-1'>
						{right}
						{items.length > 0 && (
							<motion.div
								initial={false}
								animate={searchOpen ? { opacity: 0, scale: 0.6 } : { opacity: 1, scale: 1 }}
								transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
								className={cn('origin-center', searchOpen && 'pointer-events-none')}
							>
								<MenuButton open={mobileOpen} onToggle={toggleMobile} forced={navCollapsed} />
							</motion.div>
						)}
					</div>
				</div>
			</header>

			{items.length > 0 && (
				<MobileSidebar
					open={mobileOpen}
					items={items}
					avatarUrl={avatarUrl}
					checkActive={checkActive}
					onClose={closeMobile}
					account={account}
					onOpenAccountMenu={account.canSwitch ? openAccountMenuFromSidebar : undefined}
					forced={navCollapsed}
				/>
			)}
		</AppBarContext>
	)
}
AppBar.displayName = 'AppBar'
