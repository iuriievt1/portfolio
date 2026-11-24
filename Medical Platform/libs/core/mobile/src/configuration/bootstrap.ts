export interface ReleaseAddresses {
	serverUrl: string | null
	oidcDiscoveryUrl: string | null
}

export type AddressName = keyof ReleaseAddresses
export type AddressSource = "managed" | "release"

export interface ResolvedAddresses {
	ok: true
	serverUrl: string
	oidcDiscoveryUrl: string
	sources: Record<AddressName, AddressSource>
}

export interface MissingAddresses {
	ok: false
	missing: AddressName[]
}

export type BootstrapResolution = ResolvedAddresses | MissingAddresses

export interface ResolveOptions {
	allowHttp?: boolean
}

export const MANAGED_KEYS: Record<AddressName, string> = {
	serverUrl: "server_url",
	oidcDiscoveryUrl: "oidc_discovery_url",
}

const ADDRESS_NAMES: AddressName[] = ["serverUrl", "oidcDiscoveryUrl"]

export function isValidAddress(value: unknown, options: ResolveOptions = {}): value is string {
	if (typeof value !== "string") {
		return false
	}
	try {
		const url = new URL(value)
		return url.protocol === "https:" || (options.allowHttp === true && url.protocol === "http:")
	} catch {
		return false
	}
}

function candidate(
	name: AddressName,
	managed: Readonly<Record<string, unknown>>,
	release: ReleaseAddresses,
): { value: unknown; source: AddressSource } {
	const key = MANAGED_KEYS[name]
	if (key in managed) {
		return { value: managed[key], source: "managed" }
	}
	return { value: release[name], source: "release" }
}

export function resolveBootstrap(
	managed: Readonly<Record<string, unknown>>,
	release: ReleaseAddresses,
	options: ResolveOptions = {},
): BootstrapResolution {
	const resolved: Partial<Record<AddressName, string>> = {}
	const sources: Partial<Record<AddressName, AddressSource>> = {}
	const missing: AddressName[] = []
	for (const name of ADDRESS_NAMES) {
		const { value, source } = candidate(name, managed, release)
		if (isValidAddress(value, options)) {
			resolved[name] = value
			sources[name] = source
		} else {
			missing.push(name)
		}
	}
	if (missing.length > 0) {
		return { ok: false, missing }
	}
	return {
		ok: true,
		serverUrl: resolved.serverUrl as string,
		oidcDiscoveryUrl: resolved.oidcDiscoveryUrl as string,
		sources: sources as Record<AddressName, AddressSource>,
	}
}
