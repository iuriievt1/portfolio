'use client'

import type { FeedDescriptor } from '@pkg/app/data'
import { useHeroQuery, useManifestQuery, useRailQuery } from '@pkg/app/hooks/queries'
import { useInViewport } from '@pkg/app/hooks/use-in-viewport'
import { useMinDuration } from '@pkg/app/hooks/use-min-duration'
import { PageContent } from '@pkg/design-system/components/ui/PageContent'
import { Crossfade, PageError } from '@/components'
import { HeroClient, HeroSkeleton } from '@/features/hero'
import { RailClient, RailSkeleton } from '@/features/rails'

const EAGER_RAILS = 2
const MIN_SKELETON_MS = 150

// ── Rail slots ──────────────────────────────────────────────────────

function EagerRailSlot({
	feed,
	heroSettled,
	staggerIndex,
}: {
	feed: FeedDescriptor
	heroSettled: boolean
	staggerIndex: number
}) {
	const minTimeElapsed = useMinDuration(heroSettled, MIN_SKELETON_MS)
	const { data: rail, isLoading } = useRailQuery(feed, heroSettled)

	return (
		<Crossfade
			loading={!heroSettled || isLoading || !minTimeElapsed}
			skeleton={<RailSkeleton />}
			delay={staggerIndex * 0.06}
		>
			{rail && <RailClient rail={rail} />}
		</Crossfade>
	)
}

function LazyRailSlot({ feed, heroSettled }: { feed: FeedDescriptor; heroSettled: boolean }) {
	const { ref, inView } = useInViewport()
	const shouldFetch = heroSettled && inView
	const { data: rail, isLoading } = useRailQuery(feed, shouldFetch)

	if (!shouldFetch)
		return (
			<div ref={ref}>
				<RailSkeleton />
			</div>
		)

	return (
		<Crossfade loading={isLoading} skeleton={<RailSkeleton />} enterDuration={0.18} exitDuration={0.12}>
			{rail && <RailClient rail={rail} />}
		</Crossfade>
	)
}

// ── Page ────────────────────────────────────────────────────────────

export default function HomePage() {
	const { data: manifest, isLoading: manifestLoading, error } = useManifestQuery('home')
	const heroQuery = useHeroQuery(manifest?.heroFeedId ?? null)
	const heroSettled = !manifest?.heroFeedId || !heroQuery.isLoading

	if (error) return <PageError message={error.message} />

	if (manifestLoading) {
		return (
			<>
				<HeroSkeleton />
				<PageContent>
					<RailSkeleton />
					<RailSkeleton />
					<RailSkeleton />
				</PageContent>
			</>
		)
	}

	return (
		<>
			<Crossfade
				loading={heroQuery.isLoading}
				skeleton={<HeroSkeleton />}
				enterY={8}
				enterDuration={0.28}
				exitDuration={0.18}
			>
				{heroQuery.data && <HeroClient hero={heroQuery.data} />}
			</Crossfade>
			<PageContent>
				{manifest?.feeds.map((feed, i) =>
					i < EAGER_RAILS ? (
						<EagerRailSlot key={feed.id} feed={feed} heroSettled={heroSettled} staggerIndex={i} />
					) : (
						<LazyRailSlot key={feed.id} feed={feed} heroSettled={heroSettled} />
					),
				)}
			</PageContent>
		</>
	)
}
