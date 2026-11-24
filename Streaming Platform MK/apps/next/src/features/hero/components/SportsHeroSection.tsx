import { getDataProvider } from '@pkg/app/data'
import { SportsHeroClient } from './SportsHeroClient'

export async function SportsHeroSection({ heroFeedId }: { heroFeedId: string }) {
	const provider = await getDataProvider()
	const hero = await provider.getHeroData(heroFeedId)
	if (!hero) return null
	return <SportsHeroClient hero={hero} />
}
