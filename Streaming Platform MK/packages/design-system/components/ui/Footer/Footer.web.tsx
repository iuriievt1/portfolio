import { cn } from '@pkg/utils'
import { Copyright } from './Copyright'
import { FooterLink } from './FooterLink'
import { Nav } from './Nav'
import { Social } from './Social'
import { SocialIcon } from './SocialIcon'
import type { FooterProps } from './types'

function FooterRoot({ children, className }: FooterProps) {
	return (
		<footer className={cn('mt-8 border-border border-t bg-page-bg lg:mt-16', className)}>
			<div
				className={cn(
					'mx-auto flex flex-col items-center gap-5 py-8 text-center',
					'px-[var(--page-pad-sm)]',
					'lg:min-h-[132px] lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-[var(--page-pad-lg)] lg:py-0 lg:text-left',
					'xl:px-[var(--page-pad-xl)]',
					'3xl:px-[var(--page-pad-3xl)]',
				)}
			>
				{children}
			</div>
		</footer>
	)
}
FooterRoot.displayName = 'Footer'

export const Footer = Object.assign(FooterRoot, {
	Copyright,
	Nav,
	Link: FooterLink,
	Social,
	SocialIcon,
})
