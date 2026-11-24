'use client'

import { useControls } from '../hooks/use-controls'
import { useTracks } from '../hooks/use-tracks'
import { MenuItem } from './MenuItem.web'
import { MenuShell } from './MenuShell.web'

const SPEED_OPTIONS = [
	{ label: '0.5x', value: 0.5 },
	{ label: '0.75x', value: 0.75 },
	{ label: 'Normal', value: 1 },
	{ label: '1.25x', value: 1.25 },
	{ label: '1.5x', value: 1.5 },
	{ label: '1.75x', value: 1.75 },
	{ label: '2x', value: 2 },
]

export function SpeedMenu() {
	const { activeMenu, closeMenu } = useControls()
	const { playbackSpeed, setSpeed } = useTracks()

	return (
		<MenuShell isOpen={activeMenu === 'speed'} onClose={closeMenu} title='Speed'>
			{SPEED_OPTIONS.map((opt) => (
				<MenuItem
					key={opt.value}
					label={opt.label}
					active={playbackSpeed === opt.value}
					onClick={() => setSpeed(opt.value)}
				/>
			))}
		</MenuShell>
	)
}
