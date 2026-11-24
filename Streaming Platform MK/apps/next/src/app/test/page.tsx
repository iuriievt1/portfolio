import { createMockDataProvider } from '@pkg/app/data/mock-provider'
import type { Metadata } from 'next'
import { TestClient } from '@/features/dev'

export const metadata: Metadata = {
	title: 'Shared Screen Test',
	description: 'Testing shared HomeScreen from packages/app with both VOD and Live hero variants.',
}

export default async function TestPage() {
	const provider = createMockDataProvider()
	const [homeManifest, sportsManifest] = await Promise.all([
		provider.getPageFeedManifest('home'),
		provider.getPageFeedManifest('sports'),
	])

	const [vodHero, liveHero, ...railResults] = await Promise.all([
		homeManifest.heroFeedId ? provider.getHeroData(homeManifest.heroFeedId) : null,
		sportsManifest.heroFeedId ? provider.getHeroData(sportsManifest.heroFeedId) : null,
		...homeManifest.feeds.slice(0, 3).map((feed) => provider.getRailData(feed)),
	])

	const rails = railResults.filter((r): r is NonNullable<typeof r> => r != null)

	return <TestClient vodHero={vodHero} liveHero={liveHero} rails={rails} />
}
