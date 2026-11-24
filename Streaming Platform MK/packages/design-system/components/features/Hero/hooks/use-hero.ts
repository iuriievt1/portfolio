import { use } from 'react'
import {
	type HeroActions,
	type HeroContextValue,
	type HeroMeta,
	HeroMetaContext,
	type HeroState,
	HeroStateContext,
} from '../context'

/** Read only static metadata (count, autoPlayMs). Never re-renders on state changes. */
export function useHeroMeta(): HeroMeta {
	const ctx = use(HeroMetaContext)
	if (!ctx) throw new Error('useHeroMeta must be used within <Hero>')
	return ctx
}

/** Read interaction state + actions. Re-renders on active slide / hover changes. */
export function useHeroState(): { state: HeroState; actions: HeroActions } {
	const ctx = use(HeroStateContext)
	if (!ctx) throw new Error('useHeroState must be used within <Hero>')
	return ctx
}

/** Convenience hook — subscribes to both meta and state. Prefer useHeroMeta() when you only need metadata. */
export function useHero(): HeroContextValue {
	return { ...useHeroState(), meta: useHeroMeta() }
}
