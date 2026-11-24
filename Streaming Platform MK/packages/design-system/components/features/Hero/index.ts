import { Arrows } from './Arrows/Arrows'
import { BrandingLogo } from './BrandingLogo/BrandingLogo'
import { Content } from './Content/Content'
import { LiveContent } from './Content/LiveContent'
import { Dots } from './Dots/Dots'
import { Loading } from './Loading/Loading'
import { Hero as HeroProvider } from './Root/Hero'
import { Slide } from './Slide/Slide'

/**
 * Hero — compound component for full-width hero carousel.
 *
 * Pages compose the hero by picking the sub-components they need:
 *
 *   <Hero hero={data}>
 *     <Hero.Slide items={data.items}>
 *       {(item) => <Hero.Content item={item} />}       // or Hero.LiveContent
 *     </Hero.Slide>
 *     <Hero.Dots />
 *     <Hero.Arrows direction="left" onClick={prev} />
 *   </Hero>
 *
 * Content overlays (pick ONE per hero):
 *   - Content      — VOD / on-demand: filled badge, year + duration, "Watch Now"
 *   - LiveContent  — Live events: outline badge, startTime, "Watch Live" + "Watch from Start"
 *
 * Optional add-ons (compose alongside content):
 *   - BrandingLogo — event/sponsor logo, bottom-right (reads item.brandingLogoUrl)
 */
export const Hero = Object.assign(HeroProvider, {
	Slide,
	Content,
	LiveContent,
	BrandingLogo,
	Dots,
	Arrows,
	Loading,
})

export type { HeroActions, HeroContextValue, HeroMeta, HeroState } from './context'
export { useHero, useHeroMeta, useHeroState } from './hooks/use-hero'
export { useHeroCarousel } from './hooks/use-hero-carousel'
export type { HeroCta, HeroData, HeroItemData } from './types'
