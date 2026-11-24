import { cn } from '@pkg/utils'
import Image from 'next/image'
import type { HeroItemData } from '../types'

type BrandingLogoProps = {
	item: HeroItemData
	className?: string
}

/**
 * Hero.BrandingLogo — event or sponsor logo, positioned bottom-right.
 *
 * Reads item.brandingLogoUrl — renders nothing if absent.
 * Compose alongside any content overlay (LiveContent, Content, etc.):
 *
 *   <Hero.Slide items={items}>
 *     {(item) => (
 *       <>
 *         <Hero.LiveContent item={item} />
 *         <Hero.BrandingLogo item={item} />
 *       </>
 *     )}
 *   </Hero.Slide>
 */
export function BrandingLogo({ item, className }: BrandingLogoProps) {
	if (!item.brandingLogoUrl) return null

	return (
		<div
			className={cn(
				'absolute z-hero-content hidden md:block',
				'right-[var(--page-pad-sm)] bottom-14',
				'md:bottom-20',
				'lg:right-[var(--page-pad-lg)]',
				'xl:right-[var(--page-pad-xl)] xl:bottom-24',
				'3xl:right-[var(--page-pad-3xl)]',
				className,
			)}
		>
			<Image
				src={item.brandingLogoUrl}
				alt=''
				width={200}
				height={56}
				className='h-8 w-auto object-contain object-right lg:h-10 xl:h-14'
				unoptimized
			/>
		</div>
	)
}
BrandingLogo.displayName = 'Hero.BrandingLogo'
