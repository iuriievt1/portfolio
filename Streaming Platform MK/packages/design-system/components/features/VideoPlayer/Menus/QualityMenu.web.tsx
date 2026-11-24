'use client'

import { useControls } from '../hooks/use-controls'
import { useTracks } from '../hooks/use-tracks'
import { MenuItem } from './MenuItem.web'
import { MenuShell } from './MenuShell.web'

export function QualityMenu({ autoLabel = 'Auto' }: { autoLabel?: string } = {}) {
	const { activeMenu, closeMenu } = useControls()
	const { videoQualities, selectedQualityId, setQuality } = useTracks()

	return (
		<MenuShell isOpen={activeMenu === 'quality'} onClose={closeMenu} title='Quality'>
			<MenuItem label={autoLabel} active={selectedQualityId === null} onClick={() => setQuality(null)} />
			{videoQualities.map((q) => (
				<MenuItem key={q.id} label={q.label} active={selectedQualityId === q.id} onClick={() => setQuality(q.id)} />
			))}
		</MenuShell>
	)
}
