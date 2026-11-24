'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DURATION } from '../../../../tokens'
import { ControlsContext } from '../context'
import { usePlayer } from '../hooks/use-player'
import type { ActiveMenu } from '../types'

export function ControlsProvider({ children }: { children: ReactNode }) {
	const { wrapperRef } = usePlayer()
	const [visible, setVisible] = useState(true)
	const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

	const clearTimer = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current)
			timerRef.current = undefined
		}
	}, [])

	const startTimer = useCallback(() => {
		clearTimer()
		timerRef.current = setTimeout(() => {
			setVisible(false)
		}, DURATION.controlsIdle)
	}, [clearTimer])

	const showControls = useCallback(() => {
		setVisible(true)
		startTimer()
	}, [startTimer])

	const hideControls = useCallback(() => {
		setVisible(false)
		clearTimer()
	}, [clearTimer])

	const openMenu = useCallback(
		(menu: ActiveMenu) => {
			setActiveMenu(menu)
			clearTimer()
		},
		[clearTimer],
	)

	const closeMenu = useCallback(() => {
		setActiveMenu(null)
		startTimer()
	}, [startTimer])

	const toggleFullscreen = useCallback(() => {
		if (document.fullscreenElement) {
			document.exitFullscreen()
		} else {
			wrapperRef.current?.requestFullscreen({ navigationUI: 'hide' }).catch((e) => console.warn('[VideoPlayer]', e))
		}
	}, [wrapperRef])

	// Sync fullscreen state with document events
	useEffect(() => {
		const onFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement)
		}
		document.addEventListener('fullscreenchange', onFullscreenChange)
		return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
	}, [])

	// Start idle timer on mount
	useEffect(() => {
		startTimer()
		return clearTimer
	}, [startTimer, clearTimer])

	const value = useMemo(
		() => ({
			visible,
			activeMenu,
			isFullscreen,
			showControls,
			hideControls,
			openMenu,
			closeMenu,
			toggleFullscreen,
		}),
		[visible, activeMenu, isFullscreen, showControls, hideControls, openMenu, closeMenu, toggleFullscreen],
	)

	return <ControlsContext value={value}>{children}</ControlsContext>
}
