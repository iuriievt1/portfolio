import type { DiscoveryReader } from "@ansora/core-mobile"
import { JSON_CONTENT_TYPE } from "./client"

export const discoveryReader: DiscoveryReader = {
	async read(url: string): Promise<unknown> {
		const response = await fetch(url, { headers: { accept: JSON_CONTENT_TYPE } })
		if (!response.ok) {
			throw new Error(`discovery at ${url} answered ${response.status}`)
		}
		return await response.json()
	},
}
