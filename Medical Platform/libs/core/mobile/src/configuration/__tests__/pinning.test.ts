import { describe, expect, it } from "vitest"
import {
	fingerprintsOf,
	isSpkiFingerprint,
	pinnedHost,
	requiresPinning,
	resolvePinning,
	sameFingerprints,
} from "../pinning"

const PRIMARY = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
const BACKUP = "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
const ROTATED = "sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC="

const release = { pinningFingerprints: [PRIMARY, BACKUP] }

describe("pinning fingerprints of the mobile app", () => {
	it("CAP-010-R07 takes the fingerprints from managed configuration over the release", () => {
		expect(resolvePinning({ pinning_fingerprints: [BACKUP, ROTATED] }, release)).toEqual({
			ok: true,
			fingerprints: [BACKUP, ROTATED],
		})
	})

	it("CAP-010-R07 reads managed configuration given as one string with separators", () => {
		expect(resolvePinning({ pinning_fingerprints: ` ${PRIMARY},\n${BACKUP}; ${ROTATED}` }, release)).toEqual({
			ok: true,
			fingerprints: [PRIMARY, BACKUP, ROTATED],
		})
	})

	it("CAP-010-R07 uses the release fingerprints without managed configuration", () => {
		expect(resolvePinning({}, release)).toEqual({ ok: true, fingerprints: [PRIMARY, BACKUP] })
	})

	it("CAP-010-R07 does not fall back to the release when managed configuration carries the key", () => {
		expect(resolvePinning({ pinning_fingerprints: "" }, release)).toEqual({
			ok: false,
			missing: ["pinningFingerprints"],
		})
	})

	it("CAP-010-R07 tells a rotated set from the same set in another order", () => {
		expect(sameFingerprints([PRIMARY, BACKUP], [BACKUP, PRIMARY])).toBe(true)
		expect(sameFingerprints([PRIMARY, BACKUP], [BACKUP, ROTATED])).toBe(false)
		expect(sameFingerprints([PRIMARY, BACKUP], [PRIMARY, BACKUP, ROTATED])).toBe(false)
	})

	it("CAP-010-R06 refuses fewer than a primary and a backup fingerprint", () => {
		expect(resolvePinning({}, { pinningFingerprints: [PRIMARY] })).toEqual({
			ok: false,
			missing: ["pinningFingerprints"],
		})
		expect(resolvePinning({}, { pinningFingerprints: [PRIMARY, PRIMARY] })).toEqual({
			ok: false,
			missing: ["pinningFingerprints"],
		})
		expect(resolvePinning({}, { pinningFingerprints: null })).toEqual({
			ok: false,
			missing: ["pinningFingerprints"],
		})
	})

	it("CAP-010-R06 refuses a fingerprint that is not a base64 SHA-256 of the SPKI", () => {
		expect(isSpkiFingerprint(PRIMARY)).toBe(true)
		expect(isSpkiFingerprint("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")).toBe(false)
		expect(isSpkiFingerprint("sha1/AAAAAAAAAAAAAAAAAAAAAAAAAAA=")).toBe(false)
		expect(isSpkiFingerprint("sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(false)
		expect(resolvePinning({}, { pinningFingerprints: [PRIMARY, "not a fingerprint"] })).toEqual({
			ok: false,
			missing: ["pinningFingerprints"],
		})
	})

	it("CAP-010-R07 ignores values that are neither a list nor a string", () => {
		expect(fingerprintsOf(42)).toEqual([])
		expect(fingerprintsOf([PRIMARY, 7, BACKUP])).toEqual([PRIMARY, BACKUP])
	})

	it("CAP-010-R05 pins the host of an https server and leaves the development http server alone", () => {
		expect(requiresPinning("https://vulna.hospital.example:8443/api")).toBe(true)
		expect(requiresPinning("http://localhost:3000")).toBe(false)
		expect(pinnedHost("https://Vulna.Hospital.example:8443/api")).toBe("vulna.hospital.example")
	})
})
