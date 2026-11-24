'use client'

import { useNavItems } from '@pkg/app/hooks/use-hub-registry'
import { useAccounts, useStores } from '@pkg/app/providers'
import { type AccountSwitcherSection, AppBar, AppBarRight, Footer } from '@pkg/design-system'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { withBasePath } from '@/utils'

const BRAND = {
	label: 'MK.io',
	href: '/',
	logo: (
		<img
			src={withBasePath('/logos/mk-io-logo.svg')}
			alt='MK.io'
			className='h-[21px] w-[67px] sm:h-[28px] sm:w-[89px]'
		/>
	),
} as const

const AVATAR_URL = withBasePath('/logos/avatar-jake.png')

/** Config holds app-relative paths (`/logos/…`); the subpath deploy needs the base prefix. */
function resolveAvatarUrl(url: string | undefined): string | undefined {
	if (!url) return undefined
	return url.startsWith('/') ? withBasePath(url) : url
}

function normalizePath(path: string): string {
	if (path === '/') return path
	return path.replace(/\/+$/, '')
}

export function NavShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const normalizedPathname = normalizePath(pathname)
	const currentPath = useMemo(() => {
		const query = searchParams.toString()
		return query ? `${normalizedPathname}?${query}` : normalizedPathname
	}, [normalizedPathname, searchParams])
	const isVideoPage = pathname === '/title' || pathname.startsWith('/title/') || pathname.startsWith('/multiview')
	const { data: navItems } = useNavItems()
	const { accounts, activeAccountId, switchingAccountId, switchAccount } = useAccounts()
	const { stores, activeStoreId, switchingStoreId, switchStore, isLoading: storesLoading } = useStores()

	// Figma puts Stores in the left column and Accounts in the right.
	const switcherSections = useMemo<AccountSwitcherSection[]>(
		() => [
			{
				title: 'Stores',
				variant: 'stores',
				activeId: activeStoreId,
				loading: storesLoading,
				items: stores.map((store) => ({ id: store.id, name: store.label, initials: '' })),
			},
			{
				title: 'Accounts',
				variant: 'accounts',
				activeId: activeAccountId,
				items: accounts.map((account) => ({ ...account, avatarUrl: resolveAvatarUrl(account.avatarUrl) })),
			},
		],
		[accounts, activeAccountId, stores, activeStoreId, storesLoading],
	)

	// One handler for both sections — ids never collide (accounts are `account-N`,
	// stores are full MK store ids).
	const handleSwitcherSelect = useCallback(
		(id: string) => {
			if (accounts.some((account) => account.id === id)) {
				switchAccount(id)
				return
			}
			switchStore(id)
		},
		[accounts, switchAccount, switchStore],
	)

	const checkActive = useCallback(
		(href: string) => {
			const normalizedHref = normalizePath(href)
			if (normalizedHref === '/') return currentPath === '/'
			if (href.startsWith('/hub?')) {
				const hrefSlug = new URLSearchParams(href.split('?')[1] ?? '').get('slug')
				return normalizedPathname === '/hub' && searchParams.get('slug') === hrefSlug
			}
			return (
				currentPath === normalizedHref ||
				normalizedPathname === normalizedHref ||
				normalizedPathname.startsWith(`${normalizedHref}/`)
			)
		},
		[currentPath, normalizedPathname, searchParams],
	)

	const items = useMemo(() => navItems ?? [], [navItems])

	return (
		<div className={`flex flex-col ${isVideoPage ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
			{!isVideoPage && (
				<AppBar
					brand={BRAND}
					items={items}
					right={
						<AppBarRight
							sections={switcherSections}
							switchingId={switchingAccountId ?? switchingStoreId}
							onSelect={handleSwitcherSelect}
						/>
					}
					isActive={checkActive}
					avatarUrl={AVATAR_URL}
					pathname={currentPath}
				/>
			)}
			<main className='flex min-h-0 flex-1 flex-col'>{children}</main>
			{!isVideoPage && (
				<Footer>
					<Footer.Copyright>&copy; MK.io 2026</Footer.Copyright>
					<Footer.Nav>
						<Footer.Link href='#'>Help</Footer.Link>
						<Footer.Link href='#'>Cookie Policy</Footer.Link>
						<Footer.Link href='#'>Terms &amp; Conditions</Footer.Link>
					</Footer.Nav>
					{/* <Footer.Social>
						<Footer.SocialIcon href='https://instagram.com' label='Instagram'>
							<svg width='17' height='17' viewBox='0 0 17 17' fill='none' className='h-[17px] w-[17px]'>
								<path
									d='M11.25 0H5.11364C2.28989 0 0 2.28989 0 5.11364V11.25C0 14.0737 2.28989 16.3636 5.11364 16.3636H11.25C14.0737 16.3636 16.3636 14.0737 16.3636 11.25V5.11364C16.3636 2.28989 14.0737 0 11.25 0ZM14.8295 11.25C14.8295 13.2239 13.2239 14.8295 11.25 14.8295H5.11364C3.13977 14.8295 1.53409 13.2239 1.53409 11.25V5.11364C1.53409 3.13977 3.13977 1.53409 5.11364 1.53409H11.25C13.2239 1.53409 14.8295 3.13977 14.8295 5.11364V11.25Z'
									fill='currentColor'
								/>
								<path
									d='M8.18002 4.09082C5.92082 4.09082 4.08911 5.92252 4.08911 8.18173C4.08911 10.4409 5.92082 12.2726 8.18002 12.2726C10.4392 12.2726 12.2709 10.4409 12.2709 8.18173C12.2709 5.92252 10.4392 4.09082 8.18002 4.09082ZM8.18002 10.7385C6.7707 10.7385 5.6232 9.59105 5.6232 8.18173C5.6232 6.77139 6.7707 5.62491 8.18002 5.62491C9.58934 5.62491 10.7368 6.77139 10.7368 8.18173C10.7368 9.59105 9.58934 10.7385 8.18002 10.7385Z'
									fill='currentColor'
								/>
								<path
									d='M12.5778 4.32924C12.8789 4.32924 13.1229 4.08519 13.1229 3.78413C13.1229 3.48307 12.8789 3.23901 12.5778 3.23901C12.2768 3.23901 12.0327 3.48307 12.0327 3.78413C12.0327 4.08519 12.2768 4.32924 12.5778 4.32924Z'
									fill='currentColor'
								/>
							</svg>
						</Footer.SocialIcon>
						<Footer.SocialIcon href='https://youtube.com' label='YouTube'>
							<svg width='17' height='17' viewBox='0 0 17 17' fill='none' className='h-[17px] w-[17px]'>
								<path
									d='M15.6682 3.64073C15.2243 2.85119 14.7426 2.70596 13.7618 2.65073C12.782 2.58425 10.3183 2.55664 8.18386 2.55664C6.04534 2.55664 3.58057 2.58425 2.60182 2.64971C1.62307 2.70596 1.14034 2.85016 0.692386 3.64073C0.235227 4.42925 0 5.78744 0 8.17857C0 8.18062 0 8.18164 0 8.18164C0 8.18369 0 8.18471 0 8.18471V8.18675C0 10.5677 0.235227 11.9361 0.692386 12.7164C1.14034 13.506 1.62205 13.6491 2.6008 13.7156C3.58057 13.7729 6.04534 13.8066 8.18386 13.8066C10.3183 13.8066 12.782 13.7729 13.7628 13.7166C14.7436 13.6502 15.2253 13.507 15.6692 12.7174C16.1305 11.9371 16.3636 10.5687 16.3636 8.18778C16.3636 8.18778 16.3636 8.18471 16.3636 8.18266C16.3636 8.18266 16.3636 8.18062 16.3636 8.17959C16.3636 5.78744 16.1305 4.42925 15.6682 3.64073ZM6.13636 11.2498V5.11346L11.25 8.18164L6.13636 11.2498Z'
									fill='currentColor'
								/>
							</svg>
						</Footer.SocialIcon>
						<Footer.SocialIcon href='https://x.com' label='X'>
							<svg width='17' height='17' viewBox='0 0 17 17' fill='none' className='h-[17px] w-[17px]'>
								<path
									d='M9.52918 6.92888L15.4899 0H14.0774L8.90171 6.01625L4.76788 0H0L6.25116 9.09764L0 16.3636H1.41259L6.87827 10.0103L11.2439 16.3636H16.0118L9.52884 6.92888H9.52918ZM7.59445 9.17779L6.96108 8.27187L1.92156 1.06337H4.09121L8.15816 6.88086L8.79153 7.78678L14.0781 15.3486H11.9084L7.59445 9.17814V9.17779Z'
									fill='currentColor'
								/>
							</svg>
						</Footer.SocialIcon>
						<Footer.SocialIcon href='https://facebook.com' label='Facebook'>
							<svg width='17' height='17' viewBox='0 0 17 17' fill='none' className='h-[17px] w-[17px]'>
								<path
									d='M14.3182 0H2.04545C0.917386 0 0 0.917386 0 2.04545V14.3182C0 15.4462 0.917386 16.3636 2.04545 16.3636H8.18182V10.7386H6.13636V8.18182H8.18182V6.13636C8.18182 4.4417 9.55534 3.06818 11.25 3.06818H13.2955V5.625H12.2727C11.7082 5.625 11.25 5.57182 11.25 6.13636V8.18182H13.8068L12.7841 10.7386H11.25V16.3636H14.3182C15.4462 16.3636 16.3636 15.4462 16.3636 14.3182V2.04545C16.3636 0.917386 15.4462 0 14.3182 0Z'
									fill='currentColor'
								/>
							</svg>
						</Footer.SocialIcon>
					</Footer.Social> */}
				</Footer>
			)}
		</div>
	)
}
