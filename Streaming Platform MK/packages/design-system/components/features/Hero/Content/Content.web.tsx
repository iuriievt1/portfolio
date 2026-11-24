import { cn } from '@pkg/utils'
import Image from 'next/image'
import { Link } from 'solito/link'
import { PlayIcon } from '../../../primitives/icons/Play'
import { PlusIcon } from '../../../primitives/icons/Plus'
import { TruncatedText } from '../../../primitives/TruncatedText'
import type { HeroItemData } from '../types'

type ContentProps = {
	item: HeroItemData
	renderLink?: (props: { href: string; className: string; children: React.ReactNode }) => React.ReactNode
	ctaLabel?: string
	className?: string
}

/**
 * Hero.Content — VOD / on-demand content overlay.
 *
 * Use for movies, series, episodes — anything that is NOT a live broadcast.
 * Renders: filled badge (tagLabel), year + duration meta, title or logo, synopsis, "Watch Now" CTA.
 *
 * For live events (sports, news, concerts) use Hero.LiveContent instead.
 */
export function Content({ item, renderLink, ctaLabel = 'Watch Now', className }: ContentProps) {
	const ctaClassName =
		'inline-flex h-10 items-center gap-2 rounded bg-white px-6 text-label text-black transition-colors hover:bg-white/90'

	return (
		<div
			className={cn(
				'absolute inset-0 z-10 flex flex-col justify-end',
				'pb-14 md:pb-20 xl:pb-24',
				'3xl:px-[var(--page-pad-3xl)] px-[var(--page-pad-sm)] lg:px-[var(--page-pad-lg)] xl:px-[var(--page-pad-xl)]',
				className,
			)}
		>
			<div className='flex max-w-[520px] flex-col gap-4 md:gap-6 lg:gap-8'>
				{(item.tagLabel || item.year || item.duration) && (
					<div className='hidden flex-wrap items-center gap-3 md:flex'>
						{item.tagLabel && (
							<span className='inline-flex h-[30px] items-center rounded-md bg-live px-2.5 text-badge text-white uppercase tracking-wide'>
								{item.tagLabel}
							</span>
						)}
						{(item.year || item.duration) && (
							<span className='text-caption text-white/75'>
								{[item.year, item.duration].filter(Boolean).join(' \u2022 ')}
							</span>
						)}
					</div>
				)}

				{item.logoUrl ? (
					<Image
						src={item.logoUrl}
						alt={item.title}
						width={400}
						height={112}
						className='hidden w-auto max-w-[200px] object-contain object-left md:block md:h-16 md:max-w-[260px] lg:h-20 lg:max-w-[320px] xl:h-28 xl:max-w-[400px]'
						unoptimized
					/>
				) : null}
				<h1
					className={cn(
						'line-clamp-2 break-normal pb-1 font-bold 3xl:text-6xl text-lg text-white leading-[1.2] tracking-tight md:text-4xl xl:text-5xl',
						item.logoUrl && 'md:hidden',
					)}
				>
					{item.title}
				</h1>

				{item.synopsis && (
					<TruncatedText as='p' lines={3} className='hidden break-normal text-body text-white md:line-clamp-3'>
						{item.synopsis}
					</TruncatedText>
				)}

				<div className='flex items-center gap-3'>
					{renderLink ? (
						renderLink({
							href: item.href,
							className: ctaClassName,
							children: (
								<>
									<PlayIcon className='h-5 w-5' /> {ctaLabel}
								</>
							),
						})
					) : (
						<Link href={item.href} className={ctaClassName}>
							<PlayIcon className='h-5 w-5' /> {ctaLabel}
						</Link>
					)}
					<button
						type='button'
						aria-label='Add to watchlist'
						className='flex h-10 w-10 items-center justify-center gap-2.5 rounded bg-white/10 px-5 py-[15px] text-white transition-colors hover:bg-white/20'
					>
						<PlusIcon className='h-5 w-5 shrink-0' />
					</button>
				</div>
			</div>
		</div>
	)
}
Content.displayName = 'Hero.Content'
