import Constants from "expo-constants"
import { Platform } from "react-native"

const DEFAULT_ASSEMBLY = "1"

/** What the server reads from every request. */
export function appVersionHeader(): string {
	return `${release().version}+${release().assembly}`
}

/** What a person reads on screen. */
export function appVersionLabel(): string {
	return `${release().version} (${release().assembly})`
}

function release(): { version: string; assembly: string } {
	const config = Constants.expoConfig
	if (config?.version === undefined || config.version === null) {
		throw new Error("the app release carries no version")
	}
	return { version: config.version, assembly: assemblyOf(config) }
}

function assemblyOf(config: NonNullable<typeof Constants.expoConfig>): string {
	const assembly = Platform.OS === "ios" ? config.ios?.buildNumber : String(config.android?.versionCode ?? "")
	return assembly === undefined || assembly === null || assembly === "" ? DEFAULT_ASSEMBLY : assembly
}
