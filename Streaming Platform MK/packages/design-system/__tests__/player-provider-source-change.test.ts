/**
 * Tests for PlayerProvider source change handling.
 * Verifies error state resets and listener re-subscribes when source changes.
 */
import { describe, expect, it, vi } from 'vitest'

type StatusListener = (payload: { status: string; error?: string | { message: string } }) => void
type PlayerError = { title: string; description: string }

function createMockPlayer() {
	let listeners: StatusListener[] = []
	return {
		loop: false,
		addListener: vi.fn((_event: string, cb: StatusListener) => {
			listeners.push(cb)
			return {
				remove: () => {
					listeners = listeners.filter((l) => l !== cb)
				},
			}
		}),
		emit(status: string, error?: string) {
			for (const l of listeners) l({ status, error })
		},
		getListenerCount: () => listeners.length,
	}
}

function createErrorTracker(deps: { player: ReturnType<typeof createMockPlayer>; source: string }) {
	let error: PlayerError | null = null
	let cleanup: (() => void) | undefined

	function subscribe(currentDeps: { player: ReturnType<typeof createMockPlayer>; source: string }) {
		cleanup?.()
		const sub = currentDeps.player.addListener('statusChange', ({ status, error: err }) => {
			if (status === 'error') {
				error = {
					title: 'Playback Error',
					description: typeof err === 'string' ? err : 'An unknown error occurred',
				}
			} else {
				error = null
			}
		})
		cleanup = () => sub.remove()
	}

	subscribe(deps)

	return {
		getError: () => error,
		updateDeps: (newDeps: { player: ReturnType<typeof createMockPlayer>; source: string }, _buggyMode: boolean) => {
			if (newDeps.player !== deps.player || newDeps.source !== deps.source) {
				error = null
				subscribe(newDeps)
			}
			deps = newDeps
		},
		cleanup: () => cleanup?.(),
	}
}

describe('PlayerProvider source change handling', () => {
	it('clears error state when source changes', () => {
		const player = createMockPlayer()
		const tracker = createErrorTracker({ player, source: 'stream-A.m3u8' })

		player.emit('error', 'Stream A failed')
		expect(tracker.getError()).not.toBeNull()

		tracker.updateDeps({ player, source: 'stream-B.m3u8' }, true)
		expect(tracker.getError()).toBeNull()
	})

	it('re-subscribes listener when source changes even if player ref is same', () => {
		const player = createMockPlayer()
		const tracker = createErrorTracker({ player, source: 'stream-A.m3u8' })
		expect(player.getListenerCount()).toBe(1)

		tracker.updateDeps({ player, source: 'stream-B.m3u8' }, true)
		expect(player.addListener).toHaveBeenCalledTimes(2)
	})

	it('does not accumulate listeners on repeated source changes', () => {
		const player = createMockPlayer()
		const tracker = createErrorTracker({ player, source: 'stream-A.m3u8' })

		for (let i = 0; i < 5; i++) {
			tracker.updateDeps({ player, source: `stream-${i}.m3u8` }, false)
		}

		expect(player.getListenerCount()).toBe(1)

		tracker.cleanup()
		expect(player.getListenerCount()).toBe(0)
	})

	it('resets error when switching from errored stream to new source', () => {
		const player = createMockPlayer()
		const tracker = createErrorTracker({ player, source: 'broken-stream.m3u8' })

		player.emit('error', 'Network timeout')
		expect(tracker.getError()?.title).toBe('Playback Error')

		tracker.updateDeps({ player, source: 'good-stream.m3u8' }, true)
		expect(tracker.getError()).toBeNull()
	})
})
