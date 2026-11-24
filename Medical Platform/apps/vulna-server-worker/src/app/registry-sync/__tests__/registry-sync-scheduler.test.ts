import { describe, expect, it } from "vitest"
import { SETTINGS_POLL_MILLISECONDS } from "../constants/registry-sync.constants"
import type { SyncRunRepository } from "../repositories/sync-run.repository"
import type { RegistrySourceService } from "../services/registry-source.service"
import type { RegistrySyncService } from "../services/registry-sync.service"
import { RegistrySyncScheduler } from "../services/registry-sync-scheduler.service"
import type { RegistrySyncSettingsService } from "../services/registry-sync-settings.service"

const NOW = new Date("2026-10-06T08:00:00Z")
const HOUR_SECONDS = 3600

function schedulerWith(options: { periodSeconds?: number; lastStartedAt?: Date; hasSource?: boolean }) {
	const started: Date[] = []
	const settings = {
		current: async () => ({ daysBack: 7, daysAhead: 1, periodSeconds: options.periodSeconds }),
	} as unknown as RegistrySyncSettingsService
	const runs = { lastStartedAt: async () => options.lastStartedAt } as unknown as SyncRunRepository
	const sources = {
		current: async () => (options.hasSource === false ? undefined : {}),
	} as unknown as RegistrySourceService
	const sync = {
		run: async (_source: unknown, _settings: unknown, now: Date) => {
			started.push(now)
		},
	} as unknown as RegistrySyncService
	return { scheduler: new RegistrySyncScheduler(settings, runs, sources, sync), started }
}

describe("registry sync schedule CAP-024-R04", () => {
	it("does not run without a period", async () => {
		const { scheduler, started } = schedulerWith({})

		expect(await scheduler.runWhenDue(NOW)).toBe(SETTINGS_POLL_MILLISECONDS)
		expect(started).toEqual([])
	})

	it("runs at once when no run happened yet", async () => {
		const { scheduler, started } = schedulerWith({ periodSeconds: HOUR_SECONDS })

		await scheduler.runWhenDue(NOW)

		expect(started).toEqual([NOW])
	})

	it("waits for the period since the last run", async () => {
		const { scheduler, started } = schedulerWith({
			periodSeconds: HOUR_SECONDS,
			lastStartedAt: new Date("2026-10-06T07:59:30Z"),
		})

		expect(await scheduler.runWhenDue(NOW)).toBe(SETTINGS_POLL_MILLISECONDS)
		expect(started).toEqual([])
	})

	it("runs again once the period has passed", async () => {
		const { scheduler, started } = schedulerWith({
			periodSeconds: HOUR_SECONDS,
			lastStartedAt: new Date("2026-10-06T06:59:00Z"),
		})

		await scheduler.runWhenDue(NOW)

		expect(started).toEqual([NOW])
	})

	it("does not run without a configured PACS connection", async () => {
		const { scheduler, started } = schedulerWith({ periodSeconds: HOUR_SECONDS, hasSource: false })

		await scheduler.runWhenDue(NOW)

		expect(started).toEqual([])
	})
})
