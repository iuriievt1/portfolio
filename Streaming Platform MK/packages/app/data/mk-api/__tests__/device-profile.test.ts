import { describe, expect, it } from 'vitest'
import { buildDeviceProfile, deviceProfileHeader } from '../device-profile'

describe('device profile', () => {
	// AMP answers `result: "error"` unless the header decodes to this envelope.
	it('carries every field AMP expects', () => {
		expect(Object.keys(buildDeviceProfile()).sort()).toEqual([
			'deviceUUID',
			'model',
			'osName',
			'osVersion',
			'vendorName',
			'wvLevel',
		])
	})

	it('encodes to base64 JSON that decodes back', () => {
		const profile = buildDeviceProfile()
		expect(JSON.parse(atob(deviceProfileHeader(profile)))).toEqual(profile)
	})

	it('keeps the device id stable across calls', () => {
		expect(buildDeviceProfile().deviceUUID).toBe(buildDeviceProfile().deviceUUID)
	})
})
