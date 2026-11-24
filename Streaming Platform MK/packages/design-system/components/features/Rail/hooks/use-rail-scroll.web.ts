'use client'

import { clamp } from '@pkg/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DURATION, EASING } from '../../../../tokens/animation'
import { BREAKPOINTS } from '../../../../tokens/breakpoints'
import { computeCardWidth, getRailGap, getRailSizing, isMobileWidth } from '../../../../tokens/rail-sizing'
import { PAGE_PAD } from '../../../../tokens/spacing'
import type { RailVariant, ResponsiveCols } from '../types'

function getPagePad(winW: number): number {
	if (winW >= BREAKPOINTS['3xl']) return PAGE_PAD['3xl']
	if (winW >= BREAKPOINTS.xl) return PAGE_PAD.xl
	if (winW >= BREAKPOINTS.lg) return PAGE_PAD.lg
	return PAGE_PAD.sm
}

function resolveColsOverride(cols: ResponsiveCols | undefined, winW: number): number | undefined {
	if (!cols) return undefined
	if (winW >= BREAKPOINTS['3xl'] && cols['3xl'] != null) return cols['3xl']
	if (winW >= BREAKPOINTS['2xl'] && cols['2xl'] != null) return cols['2xl']
	if (winW >= BREAKPOINTS.xl && cols.xl != null) return cols.xl
	if (winW >= BREAKPOINTS.lg && cols.lg != null) return cols.lg
	return cols.default
}

export function useRailScroll(variant: RailVariant, colsConfig?: ResponsiveCols) {
	const scrollerRef = useRef<HTMLDivElement | null>(null)
	const containerRef = useRef<HTMLDivElement | null>(null)
	const rafRef = useRef<number | null>(null)

	const [winW, setWinW] = useState<number>(BREAKPOINTS.xl)
	const [containerW, setContainerW] = useState(0)
	const [canLeft, setCanLeft] = useState(false)
	const [canRight, setCanRight] = useState(false)
	const [rightMaskW, setRightMaskW] = useState(0)
	const [leftMaskW, setLeftMaskW] = useState(0)
	const [peekIndex, setPeekIndex] = useState<number | null>(null)

	useEffect(() => {
		setWinW(window.innerWidth)
		const onResize = () => setWinW(window.innerWidth)
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [])

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const ro = new ResizeObserver(([entry]) => {
			setContainerW(entry.contentRect.width)
		})
		ro.observe(el)
		setContainerW(el.getBoundingClientRect().width)
		return () => ro.disconnect()
	}, [])

	const isMobile = isMobileWidth(winW)
	const pagePad = getPagePad(winW)
	const sizing = useMemo(() => getRailSizing(variant, winW), [variant, winW])
	const gap = sizing.gap

	const cardW = useMemo(() => {
		if (!containerW) return 260
		const resolved = resolveColsOverride(colsConfig, winW)
		const effective = resolved ? { ...sizing, cols: resolved } : sizing
		return computeCardWidth(containerW, effective)
	}, [containerW, sizing, winW, colsConfig])

	const step = cardW + gap

	const updateScrollState = useCallback(() => {
		const el = scrollerRef.current
		if (!el) return
		const x = el.scrollLeft
		const clientW = el.clientWidth
		const scrollW = el.scrollWidth
		const max = Math.max(0, scrollW - clientW)
		const EPS = 2
		setCanLeft(x > EPS)
		setCanRight(x < max - EPS)
		setRightMaskW(clamp(scrollW - (x + clientW), 0, cardW))
		setLeftMaskW(clamp(x, 0, cardW))

		if (cardW > 0) {
			const curPad = getPagePad(winW)
			const curStep = cardW + getRailGap(winW)

			// Right edge: card partially hidden on the right
			const visibleRight = x + clientW - curPad
			const ri = Math.max(0, Math.floor((visibleRight - curPad) / curStep))
			const rCardLeft = curPad + ri * curStep
			const rCardRight = rCardLeft + cardW
			setPeekIndex(rCardLeft < visibleRight && rCardRight > visibleRight + 0.5 ? ri : null)
		}
	}, [cardW, winW])

	useEffect(() => {
		const el = scrollerRef.current
		if (!el) return
		updateScrollState()
		el.addEventListener('scroll', updateScrollState, { passive: true })
		return () => el.removeEventListener('scroll', updateScrollState)
	}, [updateScrollState])

	useEffect(() => {
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current)
		}
	}, [])

	const animateScroll = useCallback((to: number) => {
		const el = scrollerRef.current
		if (!el) return
		if (rafRef.current) cancelAnimationFrame(rafRef.current)
		const from = el.scrollLeft
		const delta = to - from
		if (Math.abs(delta) < 1) return
		const start = performance.now()
		const duration = DURATION.railScroll
		const ease = EASING.cubicOut
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / duration)
			el.scrollLeft = from + delta * ease(t)
			if (t < 1) rafRef.current = requestAnimationFrame(tick)
			else rafRef.current = null
		}
		rafRef.current = requestAnimationFrame(tick)
	}, [])

	const scrollByPage = useCallback(
		(dir: -1 | 1) => {
			const el = scrollerRef.current
			if (!el || !step) return
			const resolved = resolveColsOverride(colsConfig, winW)
			const cols = Math.ceil(resolved ?? sizing.cols)
			const current = el.scrollLeft
			const currentIdx = Math.round(current / step)
			const next = Math.max(0, currentIdx + dir * cols)
			const max = Math.max(0, el.scrollWidth - el.clientWidth)
			animateScroll(Math.min(next * step, max))
		},
		[step, sizing.cols, winW, animateScroll, colsConfig],
	)

	return {
		scrollerRef,
		containerRef,
		cardW,
		gap,
		isMobile,
		pagePad,
		canLeft,
		canRight,
		rightMaskW,
		leftMaskW,
		peekIndex,
		scrollByPage,
		updateScrollState,
	}
}
