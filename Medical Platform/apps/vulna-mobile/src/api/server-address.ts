import type { ResolvedAddresses } from "@ansora/core-mobile"

let resolved: ResolvedAddresses | undefined

export function setResolvedAddresses(addresses: ResolvedAddresses): void {
	resolved = addresses
}

export function serverUrl(): string {
	if (resolved === undefined) {
		throw new Error("server address is not resolved")
	}
	return resolved.serverUrl
}

export function oidcDiscoveryUrl(): string {
	if (resolved === undefined) {
		throw new Error("server address is not resolved")
	}
	return resolved.oidcDiscoveryUrl
}
