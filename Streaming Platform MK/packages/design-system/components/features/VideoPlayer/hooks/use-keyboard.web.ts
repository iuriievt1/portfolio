import { useEffect, useRef } from 'react'
import { useControls } from './use-controls'
import { usePlayback } from './use-playback'
import { useTracks } from './use-tracks'
import { useVolume } from './use-volume'

export function useKeyboard(): void {
	const { isPlaying, play, pause, seek, currentTime, duration, canSeek } = usePlayback()
	const { volume, setVolume, toggleMute } = useVolume()
	const { activeMenu, closeMenu, toggleFullscreen, showControls, isFullscreen } = useControls()
	const { subtitleTracks, enableSubtitle } = useTracks()
	const lastSubtitleRef = useRef<string | null>(null)

	useEffect(() => {
		function handler(e: KeyboardEvent) {
			// Don't capture keys when typing in an input
			const tag = (e.target as HTMLElement)?.tagName
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

			// Escape: close menu first, then exit fullscreen
			if (e.key === 'Escape') {
				if (activeMenu) {
					closeMenu()
				} else if (isFullscreen) {
					document.exitFullscreen()
				}
				return
			}

			switch (e.key) {
				case ' ':
				case 'Enter':
				case 'k':
				case 'K':
					e.preventDefault()
					isPlaying ? pause() : play()
					showControls()
					break
				case 'm':
				case 'M':
					toggleMute()
					showControls()
					break
				case 'c':
				case 'C': {
					const active = subtitleTracks.find((t) => t.enabled)
					if (active) {
						lastSubtitleRef.current = active.id
						enableSubtitle(null)
					} else {
						const target = subtitleTracks.find((t) => t.id === lastSubtitleRef.current) ?? subtitleTracks[0]
						if (target) enableSubtitle(target.id)
					}
					showControls()
					break
				}
				case 'f':
				case 'F':
					toggleFullscreen()
					break
				case 'ArrowLeft':
					e.preventDefault()
					if (canSeek) seek(Math.max(0, currentTime - 10))
					showControls()
					break
				case 'ArrowRight':
					e.preventDefault()
					if (canSeek) seek(Math.min(duration, currentTime + 10))
					showControls()
					break
				case 'ArrowUp':
					e.preventDefault()
					setVolume(Math.min(100, volume + 10))
					showControls()
					break
				case 'ArrowDown':
					e.preventDefault()
					setVolume(Math.max(0, volume - 10))
					showControls()
					break
				default:
					// 0-9: seek to 0-90% of duration
					if (e.key >= '0' && e.key <= '9') {
						const pct = Number.parseInt(e.key, 10) / 10
						if (canSeek) seek(duration * pct)
						showControls()
					}
			}
		}

		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [
		isPlaying,
		play,
		pause,
		seek,
		currentTime,
		duration,
		canSeek,
		volume,
		setVolume,
		toggleMute,
		activeMenu,
		closeMenu,
		toggleFullscreen,
		subtitleTracks,
		enableSubtitle,
		isFullscreen,
		showControls,
	])
}
