'use client'

import { useControls } from '../hooks/use-controls'
import { useTracks } from '../hooks/use-tracks'
import { MenuItem } from './MenuItem.web'
import { MenuShell } from './MenuShell.web'

export function CCMenu({ offLabel = 'Off' }: { offLabel?: string } = {}) {
	const { activeMenu, closeMenu } = useControls()
	const { subtitleTracks, enableSubtitle } = useTracks()

	const noneActive = !subtitleTracks.some((t) => t.enabled)

	return (
		<MenuShell isOpen={activeMenu === 'cc'} onClose={closeMenu} title='Closed Captions'>
			<MenuItem label={offLabel} active={noneActive} onClick={() => enableSubtitle(null)} />
			{subtitleTracks.map((t) => (
				<MenuItem
					key={t.id}
					label={t.label}
					active={t.enabled}
					badge={t.isCC ? 'CC' : undefined}
					onClick={() => enableSubtitle(t.id)}
				/>
			))}
		</MenuShell>
	)
}
