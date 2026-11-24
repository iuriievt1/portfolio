import { describe, expect, it } from 'vitest'
import { resolveHomeHubId } from '../home-hub'

const IBC_HOME = 'cf2215b1-5b9e-4107-9101-0efeddfe73be'
const DEMO_APP_HOME = 'e8f29bdb-4819-4b1f-b832-2d180e63f69d'
const DEMO_APP_SPORTS = '345306f1-d3dd-4afe-9085-c5accbce0530'

describe('resolveHomeHubId', () => {
	it('uses the configured hub when the active store has it', () => {
		expect(resolveHomeHubId(IBC_HOME, [IBC_HOME])).toBe(IBC_HOME)
	})

	it('falls back to the first hub when the configured one belongs to another store', () => {
		expect(resolveHomeHubId(IBC_HOME, [DEMO_APP_HOME, DEMO_APP_SPORTS])).toBe(DEMO_APP_HOME)
	})

	it('falls back to the first hub when nothing is configured', () => {
		expect(resolveHomeHubId('', [DEMO_APP_HOME, DEMO_APP_SPORTS])).toBe(DEMO_APP_HOME)
		expect(resolveHomeHubId(undefined, [DEMO_APP_HOME])).toBe(DEMO_APP_HOME)
	})

	it('ignores a configured id that is only whitespace', () => {
		expect(resolveHomeHubId('   ', [DEMO_APP_HOME])).toBe(DEMO_APP_HOME)
	})

	it('returns null when the store has no hubs at all', () => {
		expect(resolveHomeHubId(IBC_HOME, [])).toBeNull()
		expect(resolveHomeHubId('', [])).toBeNull()
	})

	it('picks the configured hub even when it is not first', () => {
		expect(resolveHomeHubId(DEMO_APP_SPORTS, [DEMO_APP_HOME, DEMO_APP_SPORTS])).toBe(DEMO_APP_SPORTS)
	})
})
