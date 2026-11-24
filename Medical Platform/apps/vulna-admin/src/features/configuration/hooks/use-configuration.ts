import { useCallback } from "react"
import { callApi } from "@/api/client"
import type {
	Configuration,
	ConfigurationChange,
	ConfigurationSaveResult,
} from "@/features/configuration/types/configuration.types"
import { type RequestState, useRequest } from "@/lib/use-request"

const CONFIGURATION_PATH = "/configuration"

export function useConfiguration(): RequestState<Configuration> {
	const load = useCallback(() => callApi<Configuration>(CONFIGURATION_PATH), [])
	return useRequest(load)
}

export function changeConfiguration(change: ConfigurationChange): Promise<ConfigurationSaveResult> {
	return callApi<ConfigurationSaveResult>(CONFIGURATION_PATH, { method: "PATCH", body: JSON.stringify(change) })
}
