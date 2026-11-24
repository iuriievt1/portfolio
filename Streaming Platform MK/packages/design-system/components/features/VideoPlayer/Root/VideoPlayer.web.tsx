'use client'

import { ControlsProvider } from '../providers/ControlsProvider.web'
import { PlaybackProvider } from '../providers/PlaybackProvider.web'
import { PlayerProvider } from '../providers/PlayerProvider.web'
import { TracksProvider } from '../providers/TracksProvider.web'
import { VolumeProvider } from '../providers/VolumeProvider.web'
import type { VideoPlayerProps } from '../types'

export function VideoPlayer({ source, title, hlsUrl, onError, tweaks, children }: VideoPlayerProps) {
	return (
		<PlayerProvider source={source} title={title} hlsUrl={hlsUrl} onError={onError} tweaks={tweaks}>
			<PlaybackProvider>
				<VolumeProvider>
					<TracksProvider>
						<ControlsProvider>{children}</ControlsProvider>
					</TracksProvider>
				</VolumeProvider>
			</PlaybackProvider>
		</PlayerProvider>
	)
}
