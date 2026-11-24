'use client'

import type { MKVolumeChangedEvent } from '@mediakind/mkplayer'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { VolumeContext } from '../context'
import { usePlayer } from '../hooks/use-player'
import type { PlayerRuntime } from '../utils/sdk.web'
import { volumeStateForLevel } from '../utils/volume'

export function VolumeProvider({ children }: { children: ReactNode }) {
	const { player } = usePlayer()
	const [volume, setVolumeState] = useState(100)
	const [isMuted, setIsMuted] = useState(false)

	useEffect(() => {
		if (!player) return

		const onVolumeChanged = (e: MKVolumeChangedEvent) => setVolumeState(e.targetVolume)
		const onMuted = () => setIsMuted(true)
		const onUnmuted = () => setIsMuted(false)

		const p = player as unknown as PlayerRuntime
		p.on('volumechanged', onVolumeChanged as (...args: unknown[]) => void)
		p.on('muted', onMuted)
		p.on('unmuted', onUnmuted)

		// Sync initial state
		setVolumeState(player.getVolume())
		setIsMuted(player.isMuted())

		return () => {
			p.off('volumechanged', onVolumeChanged as (...args: unknown[]) => void)
			p.off('muted', onMuted)
			p.off('unmuted', onUnmuted)
		}
	}, [player])

	// Both actions update state up front: the SDK only echoes `volumechanged`/`muted` for some
	// issuers, and without a local update the slider stays where it was (#62).
	const setVolume = useCallback(
		(level: number) => {
			const next = volumeStateForLevel({ volume, isMuted }, level)
			setVolumeState(next.volume)
			setIsMuted(next.isMuted)
			player?.setVolume(next.volume)
			if (isMuted && !next.isMuted) player?.unmute()
		},
		[player, volume, isMuted],
	)

	const toggleMute = useCallback(() => {
		const next = !isMuted
		setIsMuted(next)
		if (next) player?.mute()
		else player?.unmute()
	}, [player, isMuted])

	const value = useMemo(() => ({ volume, isMuted, setVolume, toggleMute }), [volume, isMuted, setVolume, toggleMute])

	return <VolumeContext value={value}>{children}</VolumeContext>
}
