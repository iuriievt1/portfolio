import type { FeedDescriptor } from '@pkg/app/data'
import { getDataProvider } from '@pkg/app/data'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
	try {
		const { feeds } = (await req.json()) as { feeds: FeedDescriptor[] }

		if (!Array.isArray(feeds) || feeds.length === 0) {
			return NextResponse.json([], { status: 200 })
		}

		const provider = await getDataProvider()
		const data = await Promise.all(feeds.map((feed) => provider.getRailData(feed)))
		return NextResponse.json(data)
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error'
		console.error('[api/rails] Rail fetch failed:', err)
		return NextResponse.json({ error: message }, { status: 500 })
	}
}
