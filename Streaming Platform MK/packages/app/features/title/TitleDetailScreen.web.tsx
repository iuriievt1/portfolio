'use client'

import type { TitleDetail } from '@pkg/app/data'
import { useState } from 'react'
import { useSafeBack } from './use-safe-back'
import { VideoPlayer } from './VideoPlayer.web'

type Props = {
	id: string
	title: TitleDetail | null
}

/** Modal chrome shared by the playback error and event-schedule notices. */
function NoticeModal({
	accent,
	icon,
	heading,
	message,
	poster,
}: {
	accent: string
	icon: string
	heading: string
	message: string
	poster?: string
}) {
	const handleBack = useSafeBack()

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black'>
			{poster && <img src={poster} alt='' className='absolute inset-0 h-full w-full object-cover opacity-40 blur-sm' />}
			<div className='absolute inset-0 bg-black/50' />
			<button
				type='button'
				onClick={handleBack}
				className='absolute top-6 right-6 z-20 font-light text-3xl text-white/80 transition-opacity hover:text-white'
				aria-label='Close'
			>
				&times;
			</button>
			<div className='relative z-10 flex max-w-md flex-col items-center gap-6 px-6 text-center'>
				<div className={`flex h-16 w-16 items-center justify-center rounded-full border-2 ${accent}`}>
					<span className='font-bold text-2xl'>{icon}</span>
				</div>
				<h2 className='font-bold text-white text-xl md:text-2xl'>{heading}</h2>
				<p className='text-sm text-white/70 md:text-base'>{message}</p>
				<button
					type='button'
					onClick={handleBack}
					className='w-full rounded-lg bg-white px-8 py-3 font-semibold text-black text-sm transition-opacity hover:opacity-90 md:text-base'
				>
					Go Back
				</button>
			</div>
		</div>
	)
}

function PlaybackError({ title, poster }: { title?: string; poster?: string }) {
	return (
		<NoticeModal
			accent='border-red-400 text-red-400'
			icon='!'
			heading='Playback Unavailable'
			message={
				title
					? `"${title}" is not available for playback right now.`
					: 'This content is not available for playback right now.'
			}
			poster={poster}
		/>
	)
}

/** Formats an ISO UTC timestamp in the viewer's locale, e.g. "25 June 2026 at 10:21". */
function formatEventTime(iso: string) {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))
}

/** Lock screen shown before a live event's start window or after it ends. */
function EventScheduleNotice({
	title,
	poster,
	startUtc,
	hasEnded,
}: {
	title?: string
	poster?: string
	startUtc?: string
	hasEnded: boolean
}) {
	const name = title ? `"${title}"` : 'This event'
	const message = hasEnded
		? `${name} has ended.`
		: startUtc
			? `${name} will start on ${formatEventTime(startUtc)}.`
			: `${name} is not available for playback yet.`

	return (
		<NoticeModal
			accent='border-red-400 text-red-400'
			icon='!'
			heading='Playback Unavailable'
			message={message}
			poster={poster}
		/>
	)
}

export function TitleDetailScreen({ id: _id, title }: Props) {
	const [playerError, setPlayerError] = useState(false)

	if (!title) {
		console.warn('[PLAYBACK] 3/4 TitleDetailScreen: title is null → PlaybackError')
		return <PlaybackError />
	}

	// Live events are only playable within their scheduled window — lock before/after.
	if (title.assetType === 'event') {
		const now = Date.now()
		const startMs = title.startUtc ? Date.parse(title.startUtc) : Number.NaN
		const endMs = title.endUtc ? Date.parse(title.endUtc) : Number.NaN
		if (!Number.isNaN(startMs) && now < startMs) {
			return (
				<EventScheduleNotice title={title.name} poster={title.imageUrl} startUtc={title.startUtc} hasEnded={false} />
			)
		}
		if (!Number.isNaN(endMs) && now > endMs) {
			return <EventScheduleNotice title={title.name} poster={title.imageUrl} hasEnded={true} />
		}
	}

	if (playerError || (!title.playbackUrl && !title.mediaId)) {
		console.warn('[PLAYBACK] 3/4 TitleDetailScreen: showing PlaybackError', {
			playerError,
			hasPlaybackUrl: !!title.playbackUrl,
			hasMediaId: !!title.mediaId,
		})
		return <PlaybackError title={title.name} poster={title.imageUrl} />
	}

	if (title.mediaId && title.playerServerUrl && title.authToken) {
		console.log('[PLAYBACK] 3/4 TitleDetailScreen → REGISTERED SDK branch', {
			mediaId: title.mediaId,
			offerId: title.offerId,
			serverUrl: title.playerServerUrl,
			ownerUid: title.ownerUid,
			hasApplicationToken: !!title.applicationToken,
			assetType: title.assetType,
			hlsUrlFallback: title.playbackUrl,
		})
		return (
			<div className='fixed inset-0 z-40 bg-black'>
				<VideoPlayer
					mediaId={title.mediaId}
					offerId={title.offerId}
					serverUrl={title.playerServerUrl}
					authToken={title.authToken}
					ownerUid={title.ownerUid}
					applicationToken={title.applicationToken}
					assetType={title.assetType}
					title={title.name}
					poster={title.imageUrl}
					hlsUrl={title.playbackUrl}
					videoId={title.assetId ?? title.id}
					programId={title.id}
					onError={() => {
						console.error(
							'[PLAYBACK] 3/4 TitleDetailScreen: onError fired from VideoPlayer (registered branch) → showing PlaybackError',
						)
						setPlayerError(true)
					}}
				/>
			</div>
		)
	}

	if (title.playbackUrl) {
		console.log('[PLAYBACK] 3/4 TitleDetailScreen → DIRECT HLS fallback branch', {
			hlsUrl: title.playbackUrl,
			reason: {
				missingMediaId: !title.mediaId,
				missingServerUrl: !title.playerServerUrl,
				missingAuthToken: !title.authToken,
			},
		})
		return (
			<div className='fixed inset-0 z-40 bg-black'>
				<VideoPlayer
					title={title.name}
					poster={title.imageUrl}
					assetType={title.assetType}
					hlsUrl={title.playbackUrl}
					videoId={title.assetId ?? title.id}
					programId={title.id}
					onError={() => {
						console.error(
							'[PLAYBACK] 3/4 TitleDetailScreen: onError fired from VideoPlayer (direct HLS branch) → showing PlaybackError',
						)
						setPlayerError(true)
					}}
				/>
			</div>
		)
	}

	console.warn('[PLAYBACK] 3/4 TitleDetailScreen: no branch matched, rendering null')
	return null
}
