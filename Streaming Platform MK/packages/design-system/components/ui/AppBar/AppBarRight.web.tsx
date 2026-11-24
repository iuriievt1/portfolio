'use client'

import { cn } from '@pkg/utils'
import { useCallback, useEffect, useRef } from 'react'
import { Avatar } from '../../primitives/Avatar'
import { AccountBadge } from '../AccountBadge'
import type { AccountSwitcherSection } from '../AccountSwitcher'
import { AccountSwitcher } from '../AccountSwitcher'
import { useAppBar } from './appbar-context'
import { SearchMorph } from './SearchMorph'
import { NARROW_MQ, useMediaQuery } from './shared'

type AppBarRightProps = {
	className?: string
	/** Stores and accounts, in column order. Nothing switchable leaves the avatar inert. */
	sections?: AccountSwitcherSection[]
	/** Id of the account or store currently being switched to. */
	switchingId?: string | null
	onSelect?: (id: string) => void
}

/** Filled dropdown arrow matching Figma spec */
function DropdownArrow({ className }: { className?: string }) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5' fill='none' className={className}>
			<path
				d='M6.65857 0.0795753L1.01619 0.000105178C0.118571 -0.0125373 -0.339775 1.07233 0.295003 1.70711L3.15593 4.56804C3.54645 4.95856 4.17962 4.95856 4.57014 4.56804L7.3516 1.78658C7.97678 1.16141 7.54262 0.0920265 6.65857 0.0795753Z'
				fill='currentColor'
			/>
		</svg>
	)
}

export function AppBarRight({ className, sections = [], switchingId = null, onSelect }: AppBarRightProps) {
	const {
		searchOpen,
		toggleSearch,
		closeSearch,
		avatarUrl,
		accountMenuOpen: menuOpen,
		accountMenuAnchor: anchorRect,
		setAccount,
		toggleAccountMenu,
		setAccountMenuAnchor,
		closeAccountMenu: closeMenu,
		navCollapsed,
	} = useAppBar()
	const isNarrow = useMediaQuery(NARROW_MQ)
	// A collapsed nav puts the account card in the sidebar, so the inline trigger stands down.
	const hideAvatar = (searchOpen && isNarrow) || !!navCollapsed
	const wrapperRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)

	const switchableCount = sections.reduce((sum, section) => sum + section.items.length, 0)
	const canSwitch = switchableCount > 1 && onSelect != null

	// Per Figma the trigger is the signed-in account: its picture if it has one,
	// otherwise its initials in a ring. Falls back to the app bar's own image when
	// no accounts are configured at all.
	const accountsSection = sections.find((section) => section.variant === 'accounts')
	const activeAccount = accountsSection?.items.find((item) => item.id === accountsSection.activeId)

	// The sidebar's user card is the only way in below the nav breakpoint, and the app
	// bar owns it — so it is told who is signed in, and renders the same identity the
	// trigger below does. Spread into primitives so the effect does not fire on every
	// new `sections` array.
	const { name, initials, avatarUrl: accountAvatarUrl, unresolved } = activeAccount ?? {}
	useEffect(() => {
		setAccount({ canSwitch, name, initials, avatarUrl: accountAvatarUrl, unresolved })
	}, [canSwitch, name, initials, accountAvatarUrl, unresolved, setAccount])

	// Null while the trigger is display:none — below the nav breakpoint it is, and a
	// hidden element measures as an all-zero rect that would fling the panel to the
	// top-left corner.
	const measureAnchor = useCallback(() => {
		const rect = triggerRef.current?.getBoundingClientRect()
		return rect && rect.width > 0 ? { bottom: rect.bottom, right: rect.right } : null
	}, [])

	// Search and the account menu are mutually exclusive. This effect covers
	// search-opens-second; the trigger below closes search when the menu opens second.
	useEffect(() => {
		if (searchOpen) closeMenu()
	}, [searchOpen, closeMenu])

	const toggleMenu = useCallback(() => {
		// Above the narrow breakpoint the trigger stays clickable while search is open,
		// so opening the menu has to dismiss search itself.
		if (!menuOpen && searchOpen) closeSearch()
		toggleAccountMenu(measureAnchor())
	}, [measureAnchor, menuOpen, searchOpen, closeSearch, toggleAccountMenu])

	useEffect(() => {
		if (!menuOpen) return
		const handleClick = (e: MouseEvent) => {
			const target = e.target as Element | null
			// The panel is portalled outside the wrapper — exclude it explicitly.
			if (target?.closest?.('[data-account-panel]')) return
			if (wrapperRef.current && !wrapperRef.current.contains(target as Node)) closeMenu()
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [menuOpen, closeMenu])

	// The panel is portalled, so it has to follow the trigger as the page moves. Below
	// the nav breakpoint there is no trigger to follow — the sidebar anchored the panel
	// to the app bar, and that anchor stays put.
	useEffect(() => {
		if (!menuOpen) return
		const follow = () => {
			const rect = measureAnchor()
			if (rect) setAccountMenuAnchor(rect)
		}
		window.addEventListener('scroll', follow, { passive: true })
		window.addEventListener('resize', follow)
		return () => {
			window.removeEventListener('scroll', follow)
			window.removeEventListener('resize', follow)
		}
	}, [menuOpen, measureAnchor, setAccountMenuAnchor])

	// Picking a row dismisses the panel — the switch itself carries on in the
	// background and the app bar avatar reflects it once it lands.
	const handleSelect = useCallback(
		(id: string) => {
			closeMenu()
			onSelect?.(id)
		},
		[closeMenu, onSelect],
	)

	return (
		<div ref={wrapperRef} className={cn('relative flex items-center gap-5', className)}>
			<SearchMorph open={searchOpen} onToggle={toggleSearch} className={cn(searchOpen && 'flex-1 sm:flex-none')} />

			<button
				ref={triggerRef}
				type='button'
				aria-label={canSwitch ? 'Switch account or store' : 'Profile'}
				aria-haspopup={canSwitch ? 'menu' : undefined}
				aria-expanded={canSwitch ? menuOpen : undefined}
				onClick={canSwitch ? toggleMenu : undefined}
				className={cn('group shrink-0 items-center gap-1.5', 'hidden [@media(min-width:450px)]:inline-flex')}
				style={hideAvatar ? { display: 'none' } : undefined}
			>
				{activeAccount ? (
					<AccountBadge
						label={activeAccount.initials}
						avatarUrl={activeAccount.avatarUrl}
						dimmed={activeAccount.unresolved}
						className='h-8 w-8 sm:h-9 sm:w-9'
					/>
				) : (
					<Avatar src={avatarUrl} size='sm' className='sm:h-9 sm:w-9' />
				)}
				<DropdownArrow
					className={cn(
						'text-white/60 transition-all group-hover:text-white/80',
						canSwitch && menuOpen && 'rotate-180 text-white/80',
					)}
				/>
			</button>

			{canSwitch && (
				<AccountSwitcher
					open={menuOpen && !hideAvatar}
					sections={sections}
					switchingId={switchingId}
					anchorRect={anchorRect}
					onSelect={handleSelect}
					onClose={closeMenu}
				/>
			)}
		</div>
	)
}
AppBarRight.displayName = 'AppBarRight'
