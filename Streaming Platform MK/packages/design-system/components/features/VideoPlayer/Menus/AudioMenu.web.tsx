'use client'

import type { AudioTrackOption } from '../context'
import { useControls } from '../hooks/use-controls'
import { useTracks } from '../hooks/use-tracks'
import { audioTrackMenuLabel, spansMultipleFeeds } from '../utils/audio-tracks'
import { MenuItem } from './MenuItem.web'
import { MenuShell } from './MenuShell.web'

type AudioMenuProps = {
	/** Narrowed track list; defaults to every track the stream reports. */
	tracks?: AudioTrackOption[]
}

export function AudioMenu({ tracks }: AudioMenuProps) {
	const { activeMenu, closeMenu } = useControls()
	const { audioTracks, selectedAudioId, setAudioTrack } = useTracks()
	const items = tracks ?? audioTracks
	const multiFeed = spansMultipleFeeds(items)

	return (
		<MenuShell isOpen={activeMenu === 'audio'} onClose={closeMenu} title='Audio'>
			{items.map((t) => (
				<MenuItem
					key={t.id}
					label={audioTrackMenuLabel(t, multiFeed)}
					active={selectedAudioId === t.id}
					badge={t.isAudioDescription ? 'AD' : undefined}
					onClick={() => setAudioTrack(t.id)}
				/>
			))}
		</MenuShell>
	)
}
