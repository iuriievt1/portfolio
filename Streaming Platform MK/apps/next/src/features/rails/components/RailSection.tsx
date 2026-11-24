import type { FeedDescriptor } from '@pkg/app/data'
import { getDataProvider } from '@pkg/app/data'
import { RailClient } from './RailClient'

export async function RailSection({ feed }: { feed: FeedDescriptor }) {
	const provider = await getDataProvider()
	const rail = await provider.getRailData(feed)
	if (!rail) return null
	return <RailClient rail={rail} />
}
