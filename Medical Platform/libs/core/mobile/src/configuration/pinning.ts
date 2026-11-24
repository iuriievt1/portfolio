/**
 * Fingerprints for SPKI pinning ✓ CAP-010-R06, CAP-010-R07.
 *
 * A managed device gets them from managed configuration, every other device from the release;
 * the server never overrides them ✓ `docs/spec/konfigurace-a-profily.md` kap. 2 a 4.
 */
export const MANAGED_PINNING_KEYS = {
	pinningFingerprints: "pinning_fingerprints",
} as const

export type PinningName = keyof typeof MANAGED_PINNING_KEYS

export interface ReleasePinning {
	pinningFingerprints: readonly string[] | null
}

export interface ResolvedPinning {
	ok: true
	fingerprints: string[]
}

export interface MissingPinning {
	ok: false
	missing: PinningName[]
}

export type PinningResolution = ResolvedPinning | MissingPinning

/** A primary and a backup fingerprint ✓ CAP-010-R06. */
const MINIMUM_FINGERPRINTS = 2

/** SHA-256 of the DER SubjectPublicKeyInfo in base64, prefixed with the algorithm as in RFC 7469. */
const FINGERPRINT = /^sha256\/[A-Za-z0-9+/]{43}=$/
const SEPARATORS = /[\s,;]+/
const PINNED_PROTOCOL = "https:"

export function isSpkiFingerprint(value: unknown): value is string {
	return typeof value === "string" && FINGERPRINT.test(value)
}

/** Managed configuration carries either a list or one string with separators. */
export function fingerprintsOf(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string").map((item) => item.trim())
	}
	if (typeof value === "string") {
		return value.split(SEPARATORS).filter((item) => item.length > 0)
	}
	return []
}

export function resolvePinning(managed: Readonly<Record<string, unknown>>, release: ReleasePinning): PinningResolution {
	const key = MANAGED_PINNING_KEYS.pinningFingerprints
	const candidates = fingerprintsOf(key in managed ? managed[key] : release.pinningFingerprints)
	const fingerprints = [...new Set(candidates)]
	if (fingerprints.length < MINIMUM_FINGERPRINTS || !fingerprints.every(isSpkiFingerprint)) {
		return { ok: false, missing: ["pinningFingerprints"] }
	}
	return { ok: true, fingerprints }
}

/** The native layer holds a set; the same fingerprints in another order are not a rotation ✓ CAP-010-R07. */
export function sameFingerprints(current: readonly string[], next: readonly string[]): boolean {
	const held = new Set(current)
	return held.size === new Set(next).size && next.every((fingerprint) => held.has(fingerprint))
}

/** Pinning belongs to TLS; a plain http server exists only in development ✓ CAP-010-R01, R05. */
export function requiresPinning(serverUrl: string): boolean {
	return new URL(serverUrl).protocol === PINNED_PROTOCOL
}

export function pinnedHost(serverUrl: string): string {
	return new URL(serverUrl).hostname
}
