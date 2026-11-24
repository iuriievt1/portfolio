import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const playbackState = {
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	isLive: false,
	canSeek: false,
	isBuffering: false,
	play: vi.fn(),
	pause: vi.fn(),
	seek: vi.fn(),
}

vi.mock('@pkg/design-system', () => ({
	usePlayback: () => playbackState,
}))

const putBookmarkMock = vi.fn().mockResolvedValue(undefined)
const getBookmarkMock = vi.fn().mockResolvedValue(null)
vi.mock('../../../data', () => ({
	getDataProvider: vi.fn().mockResolvedValue({ putBookmark: putBookmarkMock, getBookmark: getBookmarkMock }),
}))

// Import after mocks are set up
const { useBookmarkReporter } = await import('../use-bookmark-reporter')

function wrapper({ children }: { children: React.ReactNode }) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
	return React.createElement(QueryClientProvider, { client: qc }, children)
}

const PUT_CALL_30 = { videoId: 'v1', programId: 'prog-1', timeSeconds: 30, runtimeSeconds: 100 }

beforeEach(() => {
	vi.useFakeTimers()
	playbackState.isPlaying = false
	playbackState.currentTime = 0
	playbackState.duration = 0
	putBookmarkMock.mockClear()
	getBookmarkMock.mockClear()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('useBookmarkReporter — gating', () => {
	it('no-ops when videoId is null', () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 30
		playbackState.duration = 100
		renderHook(() => useBookmarkReporter({ videoId: null, programId: 'prog-1', assetType: 'vod' }), { wrapper })
		vi.advanceTimersByTime(60_000)
		expect(putBookmarkMock).not.toHaveBeenCalled()
	})

	it('no-ops when assetType is not vod', () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 30
		playbackState.duration = 100
		renderHook(() => useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'event' }), { wrapper })
		vi.advanceTimersByTime(60_000)
		expect(putBookmarkMock).not.toHaveBeenCalled()
	})

	it('no-ops when player duration is 0 (source not loaded)', async () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 30
		playbackState.duration = 0

		renderHook(() => useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'vod' }), { wrapper })

		await act(() => vi.advanceTimersByTimeAsync(60_000))
		expect(putBookmarkMock).not.toHaveBeenCalled()
	})
})

describe('useBookmarkReporter — periodic flush', () => {
	it('flushes every 20s while playing', async () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 30
		playbackState.duration = 100

		renderHook(() => useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'vod' }), { wrapper })

		await act(() => vi.advanceTimersByTimeAsync(20_000))
		expect(putBookmarkMock).toHaveBeenCalledTimes(1)
		expect(putBookmarkMock).toHaveBeenCalledWith(PUT_CALL_30)

		playbackState.currentTime = 60
		await act(() => vi.advanceTimersByTimeAsync(20_000))
		expect(putBookmarkMock).toHaveBeenCalledTimes(2)
	})

	it('skips periodic flush when currentTime delta < 3s', async () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 30
		playbackState.duration = 100

		renderHook(() => useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'vod' }), { wrapper })

		await act(() => vi.advanceTimersByTimeAsync(20_000))
		expect(putBookmarkMock).toHaveBeenCalledTimes(1)

		// currentTime stayed at 30 (or moved < 3s)
		playbackState.currentTime = 31
		await act(() => vi.advanceTimersByTimeAsync(20_000))
		expect(putBookmarkMock).toHaveBeenCalledTimes(1)
	})

	it('skips flush when progress >= 95%', async () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 96
		playbackState.duration = 100

		renderHook(() => useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'vod' }), { wrapper })

		await act(() => vi.advanceTimersByTimeAsync(60_000))
		expect(putBookmarkMock).not.toHaveBeenCalled()
	})

	it('does not start interval when not playing', async () => {
		playbackState.isPlaying = false
		playbackState.currentTime = 30
		playbackState.duration = 100

		renderHook(() => useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'vod' }), { wrapper })

		// Advance past the 500ms paused-debounce so we don't trigger that path
		await act(() => vi.advanceTimersByTimeAsync(60_000))
		// Paused-flush fired once at t≈500ms, but no periodic ticks
		expect(putBookmarkMock).toHaveBeenCalledTimes(1)
	})
})

describe('useBookmarkReporter — pause flush', () => {
	it('flushes 500ms after isPlaying becomes false', async () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 30
		playbackState.duration = 100

		const { rerender } = renderHook(
			(props: { isPlaying: boolean }) => {
				playbackState.isPlaying = props.isPlaying
				return useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'vod' })
			},
			{ wrapper, initialProps: { isPlaying: true } },
		)

		// User pauses
		rerender({ isPlaying: false })

		// Before 500ms: no flush
		await act(async () => {
			await vi.advanceTimersByTimeAsync(400)
		})
		expect(putBookmarkMock).not.toHaveBeenCalled()

		await act(async () => {
			await vi.advanceTimersByTimeAsync(200)
		})
		expect(putBookmarkMock).toHaveBeenCalledTimes(1)
		expect(putBookmarkMock).toHaveBeenCalledWith(PUT_CALL_30)
	})

	it('cancels pause flush if resumed within debounce window', async () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 30
		playbackState.duration = 100

		const { rerender } = renderHook(
			(props: { isPlaying: boolean }) => {
				playbackState.isPlaying = props.isPlaying
				return useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'vod' })
			},
			{ wrapper, initialProps: { isPlaying: true } },
		)

		// pause → resume within 500ms (e.g. seek-induced pause)
		rerender({ isPlaying: false })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})
		rerender({ isPlaying: true })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000)
		})

		expect(putBookmarkMock).not.toHaveBeenCalled()
	})
})

describe('useBookmarkReporter — unmount + visibility', () => {
	it('flushes on unmount', async () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 30
		playbackState.duration = 100

		const { unmount } = renderHook(
			() => useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'vod' }),
			{ wrapper },
		)

		await act(async () => {
			unmount()
			await Promise.resolve()
		})
		expect(putBookmarkMock).toHaveBeenCalledTimes(1)
		expect(putBookmarkMock).toHaveBeenCalledWith(PUT_CALL_30)
	})

	it('flushes on visibilitychange = hidden', async () => {
		playbackState.isPlaying = true
		playbackState.currentTime = 30
		playbackState.duration = 100

		renderHook(() => useBookmarkReporter({ videoId: 'v1', programId: 'prog-1', assetType: 'vod' }), { wrapper })

		const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
		try {
			await act(async () => {
				Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
				document.dispatchEvent(new Event('visibilitychange'))
				await Promise.resolve()
			})

			expect(putBookmarkMock).toHaveBeenCalledTimes(1)
			expect(putBookmarkMock).toHaveBeenCalledWith(PUT_CALL_30)
		} finally {
			if (originalDescriptor) {
				Object.defineProperty(Document.prototype, 'visibilityState', originalDescriptor)
			}
			const ownDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
			if (ownDescriptor) {
				delete (document as { visibilityState?: unknown }).visibilityState
			}
		}
	})
})
