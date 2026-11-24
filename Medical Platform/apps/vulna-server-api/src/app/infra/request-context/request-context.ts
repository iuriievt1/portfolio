import { AsyncLocalStorage } from "node:async_hooks"
import { isIPv4 } from "node:net"

export interface RequestContext {
	sourceAddress: string | undefined
}

const IPV4_MAPPED_PREFIX = "::ffff:"

const storage = new AsyncLocalStorage<RequestContext>()

export function runInRequestContext<T>(context: RequestContext, work: () => T): T {
	return storage.run(context, work)
}

// CAP-025-R04
export function requestSourceAddress(): string | undefined {
	return storage.getStore()?.sourceAddress
}

export function normalizedAddress(address: string | undefined): string | undefined {
	if (address === undefined || address === "") {
		return undefined
	}
	const mapped = address.startsWith(IPV4_MAPPED_PREFIX) ? address.slice(IPV4_MAPPED_PREFIX.length) : address
	return isIPv4(mapped) ? mapped : address
}
