import type { AdministrationContract } from "@ansora/contracts"
import type { ConfigurationEntry } from "@ansora/core-server"

export type Configuration = AdministrationContract.components["schemas"]["Configuration"]
export type ConfigurationSaveResult = AdministrationContract.components["schemas"]["ConfigurationSaveResult"]
export type MissingName = AdministrationContract.components["schemas"]["MissingName"]

export interface StoredConfiguration {
	version: number
	createdAt: Date
	authorUserId: string | null
	reason: string
	entries: ConfigurationEntry[]
}

export interface NewConfigurationVersion {
	version: number
	authorUserId: string
	reason: string
	entries: readonly ConfigurationEntry[]
}

export interface ConfigurationVersionRow {
	id: number
	created_at: Date
	author_user_id: string | null
	reason: string
}

export interface ConfigurationValueRow {
	key: string
	value: unknown
}

export interface EffectiveValues {
	version: number
	values: ReadonlyMap<string, unknown>
}

export interface PageSizePolicy {
	defaultSize: number
	maxSize: number
}
