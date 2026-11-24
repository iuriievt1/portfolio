import {
	type AddressName,
	managedConfiguration,
	networkPinning,
	type PinningName,
	pinnedHost,
	type ReleaseAddresses,
	type ReleasePinning,
	type ResolvedAddresses,
	requiresPinning,
	resolveBootstrap,
	resolvePinning,
	sameFingerprints,
} from "@ansora/core-mobile"
import Constants from "expo-constants"
import { useEffect, useState } from "react"
import { setResolvedAddresses } from "../../../api/server-address"

export interface MissingConfiguration {
	ok: false
	missing: readonly (AddressName | PinningName)[]
}

export type StartResolution = ResolvedAddresses | MissingConfiguration

type Release = Partial<ReleaseAddresses & ReleasePinning>

interface Started {
	resolution: StartResolution
	fingerprints: readonly string[]
}

const MISSING_PINNING: MissingConfiguration = { ok: false, missing: ["pinningFingerprints"] }

function release(): Release {
	return (Constants.expoConfig?.extra?.release as Release | undefined) ?? {}
}

function releaseAddresses(): ReleaseAddresses {
	const carried = release()
	return { serverUrl: carried.serverUrl ?? null, oidcDiscoveryUrl: carried.oidcDiscoveryUrl ?? null }
}

function releasePinning(): ReleasePinning {
	return { pinningFingerprints: release().pinningFingerprints ?? null }
}

/** The fingerprints reach the native network layer before the first request ✓ CAP-010-R05, R06. */
async function applyPins(serverUrl: string, fingerprints: readonly string[]): Promise<boolean> {
	try {
		await networkPinning().setPins(pinnedHost(serverUrl), fingerprints)
		return true
	} catch {
		return false
	}
}

/** An https server without valid fingerprints is not configured ✓ CAP-010-R06, R07. */
async function pinServer(
	managed: Readonly<Record<string, unknown>>,
	serverUrl: string,
): Promise<readonly string[] | undefined> {
	if (!requiresPinning(serverUrl)) {
		return []
	}
	const pinning = resolvePinning(managed, releasePinning())
	if (!pinning.ok) {
		return undefined
	}
	return (await applyPins(serverUrl, pinning.fingerprints)) ? pinning.fingerprints : undefined
}

async function start(): Promise<Started> {
	const managed = await managedConfiguration().read()
	const addresses = resolveBootstrap(managed, releaseAddresses(), { allowHttp: __DEV__ })
	if (!addresses.ok) {
		return { resolution: addresses, fingerprints: [] }
	}
	const fingerprints = await pinServer(managed, addresses.serverUrl)
	if (fingerprints === undefined) {
		return { resolution: MISSING_PINNING, fingerprints: [] }
	}
	setResolvedAddresses(addresses)
	return { resolution: addresses, fingerprints }
}

/**
 * A rotation pushed by the MDM counts from the next connection, without a restart ✓ CAP-010-R07,
 * `docs/spec/konfigurace-a-profily.md` kap. 2.2. A configuration that does not resolve leaves the
 * fingerprints in place; the next start reports it. Addresses change only at the next start.
 */
function followManagedRotation(serverUrl: string, applied: readonly string[]): () => void {
	if (!requiresPinning(serverUrl)) {
		return () => undefined
	}
	let current = applied
	const subscription = managedConfiguration().addListener("changed", async () => {
		const pinning = resolvePinning(await managedConfiguration().read(), releasePinning())
		if (!pinning.ok || sameFingerprints(current, pinning.fingerprints)) {
			return
		}
		if (await applyPins(serverUrl, pinning.fingerprints)) {
			current = pinning.fingerprints
		}
	})
	return () => subscription.remove()
}

export function useBootstrap(): StartResolution | undefined {
	const [resolution, setResolution] = useState<StartResolution>()
	useEffect(() => {
		let active = true
		let stopFollowing: () => void = () => undefined
		start().then((started) => {
			if (!active) {
				return
			}
			if (started.resolution.ok) {
				stopFollowing = followManagedRotation(started.resolution.serverUrl, started.fingerprints)
			}
			setResolution(started.resolution)
		})
		return () => {
			active = false
			stopFollowing()
		}
	}, [])
	return resolution
}
