'use client'

import type { MKSourceConfig } from '@mediakind/mkplayer'
import { VideoPlayer as Player } from '@pkg/design-system'
import { BookmarkReporter } from './BookmarkReporter.web'
import { useSafeBack } from './use-safe-back'

type VideoPlayerProps = {
	mediaId?: string
	offerId?: string
	serverUrl?: string
	authToken?: string
	ownerUid?: string
	applicationToken?: string
	assetType?: MKSourceConfig['assetType']
	title?: string
	poster?: string
	hlsUrl?: string
	onError?: () => void
	videoId?: string | null
	programId?: string | null
}

export function VideoPlayer({
	mediaId,
	offerId,
	serverUrl,
	authToken,
	ownerUid,
	applicationToken,
	assetType,
	title,
	poster,
	hlsUrl,
	onError,
	videoId,
	programId,
}: VideoPlayerProps) {
	const handleBack = useSafeBack()

	const source: MKSourceConfig = {
		title: title ?? 'Video',
		...(poster ? { poster } : {}),
		...(assetType ? { assetType } : {}),
		...(mediaId && serverUrl && authToken
			? {
					registered: {
						mediaId,
						offerId,
						...(applicationToken ? { applicationToken } : {}),
						environmentConfig: { serverUrl, authToken, ownerUid },
					},
				}
			: hlsUrl
				? { hls: hlsUrl }
				: {}),
	}

	console.log('[PLAYBACK] 4/4 VideoPlayer built MKSourceConfig', {
		mode: source.registered ? 'registered' : source.hls ? 'direct-hls' : 'empty',
		title: source.title,
		assetType: source.assetType,
		registered: source.registered,
		hls: source.hls,
		hlsUrlFallbackProp: hlsUrl,
	})

	return (
		<Player source={source} title={title} poster={poster} hlsUrl={hlsUrl} onError={onError}>
			<BookmarkReporter videoId={videoId ?? null} programId={programId ?? null} assetType={assetType} />
			<Player.SubtitleOverlay />
			<Player.Overlay>
				<Player.BackButton onBack={handleBack} />
				<Player.Ghost />
				<Player.Loading />
				<Player.Error />
				<Player.Controls>
					{/* Row 1: Title */}
					<Player.Title title={title} />
					{/* Rows 2 and 3 share one grid: the second column is as wide as Player.Time, so the
					    control pills end where the timeline track ends however long the clock reads. */}
					<div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5'>
						<Player.Timeline />
						<Player.Time />
						<div className='flex items-center justify-between'>
							<div className='flex h-9 items-center gap-[5px] rounded-full bg-black/20 p-[5px] sm:h-[49px]'>
								<Player.PlayPause />
								<Player.Volume />
							</div>
							<div className='flex h-9 items-center gap-[5px] rounded-full bg-black/20 p-[5px] sm:h-[49px]'>
								<Player.Subtitles />
								<Player.Audio />
								<Player.Fullscreen />
							</div>
						</div>
					</div>
				</Player.Controls>
			</Player.Overlay>
			<Player.SpeedMenu />
			<Player.CCMenu />
		</Player>
	)
}
