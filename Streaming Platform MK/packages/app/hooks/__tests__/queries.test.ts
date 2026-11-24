import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted runs before vi.mock hoisting — safe to reference in factories
const mockProvider = vi.hoisted(() => ({
	getPageFeedManifest: vi.fn(),
	getHeroData: vi.fn(),
	getRailData: vi.fn(),
	getTitleDetail: vi.fn(),
	resetCaches: vi.fn(),
}))

vi.mock('../../data', () => ({
	getDataProvider: vi.fn().mockResolvedValue(mockProvider),
}))

vi.mock('../../data/genre', () => ({
	getGenreMeta: vi.fn(),
	getGenreItems: vi.fn().mockResolvedValue([]),
}))

import { useHomeQuery, useKidsQuery, usePageQuery, useSportsQuery, useTitleDetailQuery } from '../queries'

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
		},
	})

	return function Wrapper({ children }: PropsWithChildren) {
		return React.createElement(QueryClientProvider, { client: queryClient }, children)
	}
}

beforeEach(() => {
	mockProvider.getPageFeedManifest.mockResolvedValue({
		heroFeedId: 'hero-feed',
		feeds: [],
	})
	mockProvider.getHeroData.mockResolvedValue({
		items: [{ id: '1', title: 'Hero', imageUrl: 'hero.jpg', href: '/title/1' }],
	})
})

afterEach(() => {
	vi.clearAllMocks()
})

describe('usePageQuery', () => {
	it('returns loading state initially', () => {
		const { result } = renderHook(() => usePageQuery('home'), { wrapper: createWrapper() })

		expect(result.current.isLoading).toBe(true)
		expect(result.current.data).toBeUndefined()
	})

	it('calls fetchPage with correct pageId', async () => {
		const { result } = renderHook(() => usePageQuery('sports'), { wrapper: createWrapper() })

		await waitFor(() => expect(result.current.isSuccess).toBe(true))

		expect(mockProvider.getPageFeedManifest).toHaveBeenCalledWith('sports')
	})

	it('returns hero and rails data on success', async () => {
		mockProvider.getPageFeedManifest.mockResolvedValue({
			heroFeedId: 'hero-1',
			feeds: [],
		})
		mockProvider.getHeroData.mockResolvedValue({
			items: [{ id: 'h1', title: 'Test Hero', imageUrl: 'h.jpg', href: '/title/h1' }],
		})

		const { result } = renderHook(() => usePageQuery('home'), { wrapper: createWrapper() })

		await waitFor(() => expect(result.current.isSuccess).toBe(true))

		expect(result.current.data?.hero).toBeDefined()
		expect(result.current.data?.rails).toEqual([])
	})
})

describe('useHomeQuery', () => {
	it('delegates to usePageQuery with "home"', async () => {
		const { result } = renderHook(() => useHomeQuery(), { wrapper: createWrapper() })

		await waitFor(() => expect(result.current.isSuccess).toBe(true))

		expect(mockProvider.getPageFeedManifest).toHaveBeenCalledWith('home')
	})
})

describe('useSportsQuery', () => {
	it('delegates to usePageQuery with "sports"', async () => {
		const { result } = renderHook(() => useSportsQuery(), { wrapper: createWrapper() })

		await waitFor(() => expect(result.current.isSuccess).toBe(true))

		expect(mockProvider.getPageFeedManifest).toHaveBeenCalledWith('sports')
	})
})

describe('useKidsQuery', () => {
	it('delegates to usePageQuery with "kids"', async () => {
		const { result } = renderHook(() => useKidsQuery(), { wrapper: createWrapper() })

		await waitFor(() => expect(result.current.isSuccess).toBe(true))

		expect(mockProvider.getPageFeedManifest).toHaveBeenCalledWith('kids')
	})
})

describe('useTitleDetailQuery', () => {
	/** One client across both mounts, with React Query's real cache retention. */
	function sharedWrapper() {
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		return function Wrapper({ children }: PropsWithChildren) {
			return React.createElement(QueryClientProvider, { client: queryClient }, children)
		}
	}

	const playable = {
		id: 't1',
		name: 'Title',
		showType: 'Movie',
		isAdult: false,
		images: [],
		playActions: [],
		mediaId: 'm1',
	}

	it('reopens on a loading state rather than the previous failed attempt (#77)', async () => {
		const wrapper = sharedWrapper()

		// A resolve that found no playable source caches as a successful null.
		mockProvider.getTitleDetail.mockResolvedValueOnce(null)
		const first = renderHook(() => useTitleDetailQuery('t1'), { wrapper })
		await waitFor(() => expect(first.result.current.isLoading).toBe(false))
		expect(first.result.current.data).toBeNull()
		first.unmount()
		await new Promise((resolve) => setTimeout(resolve, 0))

		// Reopening must not hand that null back — the screen renders its error state from it.
		mockProvider.getTitleDetail.mockResolvedValueOnce(playable)
		const second = renderHook(() => useTitleDetailQuery('t1'), { wrapper })
		expect(second.result.current.data).toBeUndefined()
		expect(second.result.current.isLoading).toBe(true)

		await waitFor(() => expect(second.result.current.data).toEqual(playable))
	})

	it('refetches on every open, so an expired playback token is never reused', async () => {
		const wrapper = sharedWrapper()

		mockProvider.getTitleDetail.mockResolvedValue(playable)
		const first = renderHook(() => useTitleDetailQuery('t1'), { wrapper })
		await waitFor(() => expect(first.result.current.data).toEqual(playable))
		first.unmount()
		await new Promise((resolve) => setTimeout(resolve, 0))

		const second = renderHook(() => useTitleDetailQuery('t1'), { wrapper })
		expect(second.result.current.isLoading).toBe(true)
		await waitFor(() => expect(second.result.current.data).toEqual(playable))
		expect(mockProvider.getTitleDetail).toHaveBeenCalledTimes(2)
	})
})
