import { getDataProvider } from '@pkg/app/data'
import { HeroClient } from './HeroClient'

export async function HeroSection({ heroFeedId }: { heroFeedId: string }) {
	const provider = await getDataProvider()
	const hero = await provider.getHeroData(heroFeedId)
	if (!hero) return null
	return <HeroClient hero={hero} />
}
