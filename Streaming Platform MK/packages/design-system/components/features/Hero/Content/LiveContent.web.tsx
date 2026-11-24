import { cn } from '@pkg/utils'
import type { ComponentType } from 'react'
import { Link } from 'solito/link'
import { PlayIcon } from '../../../primitives/icons/Play'
import { PlusIcon } from '../../../primitives/icons/Plus'
import { RestartIcon } from '../../../primitives/icons/Restart'
import { TruncatedText } from '../../../primitives/TruncatedText'
import type { HeroItemData } from '../types'

type LiveContentProps = {
	item: HeroItemData
	renderLink?: (props: { href: string; className: string; children: React.ReactNode }) => React.ReactNode
	ctaLabel?: string
	startedAtPrefix?: string
	className?: string
}

const primaryCta =
	'inline-flex h-10 items-center gap-2 rounded bg-white px-6 text-label text-black transition-colors hover:bg-white/90'

const secondaryCta =
	'inline-flex h-10 items-center gap-2 rounded bg-white/10 px-6 text-label text-white backdrop-blur-sm transition-colors hover:bg-white/20'

const iconOnlyCta =
	'flex h-10 w-10 items-center justify-center rounded bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20'

const ctaIcons: Record<string, ComponentType<{ className?: string }>> = {
	add: PlusIcon,
	play: PlayIcon,
	restart: RestartIcon,
}

/**
 * Hero.LiveContent — live event content overlay.
 *
 * Use for any live broadcast: sports, news, concerts, award shows.
 * NOT tied to a specific category — any page with live content can use this.
 * Renders: outline "Live" badge, "Starting at HH:MM", title, synopsis,
 *          "Watch Live" + secondary CTAs driven by item.ctas data.
 *
 * Pair with Hero.BrandingLogo for event/sponsor branding (bottom-right).
 *
 * For VOD content (movies, series) use Hero.Content instead.
 */
export function LiveContent({
	item,
	renderLink,
	ctaLabel = 'Watch Live',
	startedAtPrefix = 'Started at',
	className,
}: LiveContentProps) {
	return (
		<div
			className={cn(
				'absolute inset-0 z-hero-content flex flex-col justify-end',
				'pb-14 md:pb-20 xl:pb-24',
				'3xl:px-[var(--page-pad-3xl)] px-[var(--page-pad-sm)] lg:px-[var(--page-pad-lg)] xl:px-[var(--page-pad-xl)]',
				className,
			)}
		>
			<div className='flex max-w-md flex-col gap-3 md:max-w-lg md:gap-5 xl:max-w-xl xl:gap-7'>
				{/* Outline badge (always visible) + broadcast time (hidden on mobile) */}
				{(item.tagLabel || item.startTime) && (
					<div className='flex items-center gap-2 md:gap-3'>
						{item.tagLabel && (
							<span
								className={cn(
									'inline-flex items-center rounded border border-live font-bold text-white uppercase tracking-wider',
									'gap-1 px-2 py-0.5 text-[10px]',
									'md:gap-1.5 md:px-2.5 md:py-1 md:text-[11px]',
									'xl:px-3 xl:py-1.5 xl:text-xs',
								)}
							>
								<span className='h-1.5 w-1.5 rounded-full bg-live' />
								{item.tagLabel}
							</span>
						)}
						{item.startTime && (
							<span className='hidden text-caption text-white md:inline'>{`${startedAtPrefix} ${item.startTime}`}</span>
						)}
					</div>
				)}

				<h1 className='line-clamp-2 break-normal pb-1 font-bold 3xl:text-6xl text-lg text-white leading-[1.2] tracking-tight md:text-4xl xl:text-5xl'>
					{item.title}
				</h1>

				{item.synopsis && (
					<TruncatedText
						as='p'
						lines={3}
						className='hidden break-normal text-body text-white/75 md:line-clamp-2 xl:line-clamp-3'
					>
						{item.synopsis}
					</TruncatedText>
				)}

				<div className='flex items-center gap-2 md:gap-3'>
					{renderLink ? (
						renderLink({
							href: item.href,
							className: primaryCta,
							children: (
								<>
									<PlayIcon className='h-5 w-5' /> {ctaLabel}
								</>
							),
						})
					) : (
						<Link href={item.href} className={primaryCta}>
							<PlayIcon className='h-5 w-5' /> {ctaLabel}
						</Link>
					)}
					{item.ctas?.map((cta) => {
						const Icon = cta.icon ? ctaIcons[cta.icon] : null
						if (Icon && !cta.label) {
							return renderLink ? (
								renderLink({ href: item.href, className: iconOnlyCta, children: <Icon className='h-5 w-5 shrink-0' /> })
							) : (
								<Link key={cta.action} href={item.href} className={iconOnlyCta} aria-label={cta.label || cta.action}>
									<Icon className='h-5 w-5 shrink-0' />
								</Link>
							)
						}
						return renderLink ? (
							renderLink({
								href: item.href,
								className: secondaryCta,
								children: (
									<>
										{Icon && <Icon className='h-[22px] w-[22px] shrink-0' />}
										{cta.label}
									</>
								),
							})
						) : (
							<Link key={cta.action} href={item.href} className={secondaryCta}>
								{Icon && <Icon className='h-[22px] w-[22px] shrink-0' />}
								{cta.label}
							</Link>
						)
					})}
				</div>
			</div>
		</div>
	)
}
LiveContent.displayName = 'Hero.LiveContent'
