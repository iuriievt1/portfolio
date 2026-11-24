'use client'

import { type MultiViewConfig, MultiViewMosaicPlayer, MultiViewPlayer } from '@pkg/app/features/title'
import { useTitleDetailQuery } from '@pkg/app/hooks/queries'
import { getClientEnv } from '@pkg/utils/client-env'

const MOCK_STREAM_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

// Mirror of LIVE_CHANNEL_TITLE_ID_PREFIX (packages/app/data/mk-api/mappers.ts) — inlined to keep
// server-only provider/boot code out of the client bundle.
const LIVE_CHANNEL_TITLE_ID_PREFIX = 'live-channel:'

const MOCK_MULTIVIEW_CONFIGS: Record<string, MultiViewConfig> = {
	multiview_mv1: {
		id: 'multiview_mv1',
		title: 'MLB Doubleheader',
		count: 2,
		streams: [
			{
				id: 'multiview_mv1_main',
				label: 'American League',
				subtitle: 'Main feed',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
			{
				id: 'multiview_mv1_alt',
				label: 'National League',
				subtitle: 'Alternate feed',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
		],
	},
	multiview_mv2: {
		id: 'multiview_mv2',
		title: 'Grand Prix 500',
		count: 3,
		streams: [
			{
				id: 'multiview_mv2_main',
				label: 'Main feed',
				subtitle: 'Track camera',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
			{
				id: 'multiview_mv2_driver',
				label: 'Driver cam',
				subtitle: 'On-board angle',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
			{
				id: 'multiview_mv2_pit',
				label: 'Pit lane',
				subtitle: 'Crew feed',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
		],
	},
	multiview_mv3: {
		id: 'multiview_mv3',
		title: 'NBA Conference Finals',
		count: 4,
		streams: [
			{
				id: 'multiview_mv3_main',
				label: 'Main game',
				subtitle: 'Broadcast feed',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
			{
				id: 'multiview_mv3_rim',
				label: 'Rim cam',
				subtitle: 'Baseline angle',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
			{
				id: 'multiview_mv3_bench',
				label: 'Bench cam',
				subtitle: 'Team feed',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
			{
				id: 'multiview_mv3_tactical',
				label: 'Tactical cam',
				subtitle: 'Wide angle',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
		],
	},
	multiview_mv4: {
		id: 'multiview_mv4',
		title: 'Formula Series Qualifier',
		count: 3,
		streams: [
			{
				id: 'multiview_mv4_main',
				label: 'Main feed',
				subtitle: 'Broadcast feed',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
			{
				id: 'multiview_mv4_onboard',
				label: 'On-board',
				subtitle: 'Cockpit camera',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
			{
				id: 'multiview_mv4_sector',
				label: 'Sector cam',
				subtitle: 'Trackside angle',
				poster: '',
				hlsUrl: MOCK_STREAM_URL,
			},
		],
	},
}

export function MultiViewPageClient({ id }: { id: string }) {
	if (getClientEnv().dataSource === 'mock') {
		return <MultiViewPlayer id={id} config={MOCK_MULTIVIEW_CONFIGS[id] ?? null} />
	}
	return <ApiMultiView id={id} />
}

/** API mode: the multiview id is a live channel id (e.g. `mv-test`). Resolve its playback
 *  details and render the composited-mosaic player. */
function ApiMultiView({ id }: { id: string }) {
	const { data: title, isLoading, error } = useTitleDetailQuery(`${LIVE_CHANNEL_TITLE_ID_PREFIX}${id}`)

	if (isLoading) {
		return (
			<div className='fixed inset-0 z-50 flex items-center justify-center bg-black'>
				<div
					className='aspect-square w-[15vmin] min-w-[48px] max-w-[160px] animate-spin rounded-full border-[0.35vmin] border-white/20 border-t-white'
					style={{ transform: 'rotate(45deg)' }}
				/>
			</div>
		)
	}

	if (error || !title || (!title.mediaId && !title.playbackUrl)) {
		return <MultiViewPlayer id={id} config={null} />
	}

	return (
		<MultiViewMosaicPlayer
			mediaId={title.mediaId}
			offerId={title.offerId}
			serverUrl={title.playerServerUrl}
			authToken={title.authToken}
			ownerUid={title.ownerUid}
			applicationToken={title.applicationToken}
			spotlights={title.multiviewSpotlights}
			assetType={title.assetType}
			title={title.name}
			hlsUrl={title.playbackUrl}
		/>
	)
}
