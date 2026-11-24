// AMP (`defaultAccHostName`) rejects `/v1/client/*` without a base64 device profile — it answers
// 200 with `result: "error"`, code 43. The player SDK builds one, but it only ships on the player
// routes, so the data layer builds the same shape itself. Verified against AMP: the service reads
// the envelope, not the values.

const DEVICE_UUID_KEY = 'mk.deviceUuid'

export type DeviceProfile = {
	model: string
	osVersion: string
	vendorName: string
	osName: string
	deviceUUID: string
	wvLevel: string
}

/** Stable per browser, so AMP sees one device rather than a new one on every load. */
function deviceUuid(): string {
	if (typeof localStorage === 'undefined') return crypto.randomUUID()
	const stored = localStorage.getItem(DEVICE_UUID_KEY)
	if (stored) return stored

	const fresh = crypto.randomUUID()
	try {
		localStorage.setItem(DEVICE_UUID_KEY, fresh)
	} catch (err) {
		// Private mode and blocked storage both throw; a per-load id still satisfies AMP.
		console.warn('[LIVE] could not persist the device id, using a per-load one', err)
	}
	return fresh
}

/** The profile shape the SDK sends for a browser, filled in from what the platform reports. */
export function buildDeviceProfile(): DeviceProfile {
	const nav = typeof navigator === 'undefined' ? undefined : navigator
	return {
		model: nav?.platform || 'Unknown',
		osVersion: '',
		vendorName: nav?.vendor || 'Unknown',
		// What the SDK reports for web; browser Widevine is always software level.
		osName: 'HTML5',
		deviceUUID: deviceUuid(),
		wvLevel: 'L3',
	}
}

/** Base64 profile for the `deviceprofile` request header. */
export function deviceProfileHeader(profile: DeviceProfile = buildDeviceProfile()): string {
	return btoa(JSON.stringify(profile))
}
