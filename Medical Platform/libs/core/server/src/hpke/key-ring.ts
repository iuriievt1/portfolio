import type { KeyObject } from "node:crypto"
import type { MobileContract } from "@ansora/contracts"
import { HpkeError, open, privateKeyFromPem, serializePublicKey } from "./hpke"
import { HPKE_SUITE, type HpkeEnvelope } from "./suite"

export type ServerHpkeKey = NonNullable<
	MobileContract.components["schemas"]["EffectiveConfiguration"]["server_hpke_key"]
>

export interface StoredServerKey {
	version: string
	pem: string
}

/** The contract bounds `server_key_version` to 64 characters; the version also names the key file. */
const KEY_VERSION = /^[A-Za-z0-9._-]{1,64}$/

export function isKeyVersion(value: string): boolean {
	return KEY_VERSION.test(value)
}

export class UnknownKeyVersionError extends HpkeError {
	constructor(readonly version: string) {
		super(`No server key of version ${version}`)
		this.name = "UnknownKeyVersionError"
	}
}

export class UnsupportedSuiteError extends HpkeError {
	constructor(readonly suite: string) {
		super(`The cipher suite ${suite} is not the one the server accepts`)
		this.name = "UnsupportedSuiteError"
	}
}

/**
 * The static key pairs of the server by version ✓ CAP-021-R21. The current one goes to devices in
 * the effective configuration; the older ones stay until the oldest queue item that may still carry
 * an envelope sealed for them has arrived ✓ `docs/spec/backend.md` kap. 2.2.
 */
export class HpkeKeyRing {
	private constructor(
		private readonly keys: ReadonlyMap<string, KeyObject>,
		readonly currentVersion: string,
	) {}

	static fromPem(stored: readonly StoredServerKey[], currentVersion: string): HpkeKeyRing {
		const keys = new Map<string, KeyObject>()
		for (const { version, pem } of stored) {
			if (!isKeyVersion(version)) {
				throw new HpkeError(
					`The key version ${version} is not a short name of letters, digits, dot, dash and underscore`,
				)
			}
			if (keys.has(version)) {
				throw new HpkeError(`The key version ${version} is stored twice`)
			}
			keys.set(version, privateKeyFromPem(pem))
		}
		if (!keys.has(currentVersion)) {
			throw new UnknownKeyVersionError(currentVersion)
		}
		return new HpkeKeyRing(keys, currentVersion)
	}

	get versions(): readonly string[] {
		return [...this.keys.keys()]
	}

	/** What the device pins: the public part of the current version ✓ `EffectiveConfiguration.server_hpke_key`. */
	serverHpkeKey(): ServerHpkeKey {
		return {
			server_key_version: this.currentVersion,
			public_key: serializePublicKey(this.privateKey(this.currentVersion)).toString("base64url"),
		}
	}

	/** Opens a file the device sealed; the derived key is not kept ✓ CAP-021-R21. */
	openEnvelope(envelope: HpkeEnvelope, ciphertext: Buffer): Buffer {
		if (envelope.suite !== HPKE_SUITE) {
			throw new UnsupportedSuiteError(envelope.suite)
		}
		return open(this.privateKey(envelope.server_key_version), Buffer.from(envelope.enc, "base64url"), ciphertext)
	}

	private privateKey(version: string): KeyObject {
		const key = this.keys.get(version)
		if (key === undefined) {
			throw new UnknownKeyVersionError(version)
		}
		return key
	}
}
