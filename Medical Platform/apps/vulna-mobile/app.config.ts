import { readdirSync, readFileSync } from "node:fs"
import { basename, extname, resolve } from "node:path"
import type { ReleaseAddresses, ReleasePinning } from "@ansora/core-mobile"
import type { ExpoConfig } from "expo/config"
import colors from "./src/styles/colors.json"

const profileDirectory = process.env.PROFILE ?? "profiles/mou"
const profile = JSON.parse(readFileSync(resolve(__dirname, "../..", profileDirectory, "profile.json"), "utf8")) as {
	mobileRelease: ReleaseAddresses & ReleasePinning
}

const configurationSchema = JSON.parse(
	readFileSync(resolve(__dirname, "../..", profileDirectory, "configuration.schema.json"), "utf8"),
) as { properties: { localization: { properties: { default_language: { default: string } } } } }

const FINGERPRINT_SEPARATOR = ","

const EAS_OWNER = "veevoy"
const EAS_PROJECT_ID = "1dad718b-e5b7-497d-9de6-d781b1695923"
const APPLE_TEAM_ID = "UW826747U6"

const RELEASE_DEFAULT_LANGUAGE = configurationSchema.properties.localization.properties.default_language.default

const TEXTS_DIRECTORY = resolve(__dirname, "src/i18n")
const TEXTS_EXTENSION = ".json"

interface PermissionTexts {
	permissions?: { camera?: { body?: string }; nfc?: { body?: string } }
}

function textsOf(language: string): PermissionTexts {
	return JSON.parse(readFileSync(resolve(TEXTS_DIRECTORY, `${language}${TEXTS_EXTENSION}`), "utf8")) as PermissionTexts
}

const RELEASE_LANGUAGES = readdirSync(TEXTS_DIRECTORY)
	.filter((file) => extname(file) === TEXTS_EXTENSION)
	.map((file) => basename(file, TEXTS_EXTENSION))

const DEFAULT_TEXTS = textsOf(RELEASE_DEFAULT_LANGUAGE)

// CAP-015-R26
function permissionTextsOf(language: string) {
	const texts = textsOf(language).permissions
	const fallback = DEFAULT_TEXTS.permissions
	return {
		NSCameraUsageDescription: texts?.camera?.body ?? fallback?.camera?.body,
		NFCReaderUsageDescription: texts?.nfc?.body ?? fallback?.nfc?.body,
	}
}

// CAP-015-R22
function permissionLocales(): Record<string, { ios: ReturnType<typeof permissionTextsOf> }> {
	return Object.fromEntries(RELEASE_LANGUAGES.map((language) => [language, { ios: permissionTextsOf(language) }]))
}

const DEFAULT_PERMISSION_TEXTS = permissionTextsOf(RELEASE_DEFAULT_LANGUAGE)

function releaseFingerprints(): readonly string[] | undefined {
	const fromEnvironment: string | undefined = process.env.EXPO_PUBLIC_PINNING_FINGERPRINTS
	if (fromEnvironment !== undefined) {
		return fromEnvironment.split(FINGERPRINT_SEPARATOR).map((item) => item.trim())
	}
	return profile.mobileRelease.pinningFingerprints ?? undefined
}

// ADR-001, NAB-147, NAB-148, CAP-029-R02, NAB-632, Q-020, NAB-424, ADR-019
const config: ExpoConfig = {
	name: "Ansora Vulna",
	slug: "ansora-vulna",
	owner: EAS_OWNER,
	icon: "./assets/icon.png",
	version: "1.0.0",
	orientation: "portrait",
	scheme: "ansoravulna",
	userInterfaceStyle: "light",
	ios: {
		bundleIdentifier: "care.ansora.vulna",
		appleTeamId: APPLE_TEAM_ID,
		supportsTablet: true,
		infoPlist: {
			NSCameraUsageDescription: DEFAULT_PERMISSION_TEXTS.NSCameraUsageDescription,
			ITSAppUsesNonExemptEncryption: false,
		},
	},
	android: {
		package: "care.ansora.vulna",
		adaptiveIcon: {
			foregroundImage: "./assets/icon.png",
			backgroundColor: colors.primary,
		},
		allowBackup: false,
		permissions: ["android.permission.CAMERA"],
	},
	locales: permissionLocales(),
	plugins: [
		"expo-router",
		["expo-splash-screen", { backgroundColor: colors.background, android: { image: "./assets/icon.png" } }],
		"expo-secure-store",
		[
			"react-native-nfc-manager",
			{ nfcPermission: DEFAULT_PERMISSION_TEXTS.NFCReaderUsageDescription, includeNdefEntitlement: false },
		],
		"expo-font",
		["expo-sqlite", { useSQLCipher: true }],
		"./plugins/with-managed-configuration",
		"./plugins/with-debug-trust-anchors",
		"./plugins/with-zxing-nitro-headers",
	],
	experiments: {
		typedRoutes: true,
	},
	extra: {
		eas: {
			projectId: EAS_PROJECT_ID,
		},
		release: {
			serverUrl: process.env.EXPO_PUBLIC_SERVER_URL ?? profile.mobileRelease.serverUrl ?? undefined,
			oidcDiscoveryUrl:
				process.env.EXPO_PUBLIC_OIDC_DISCOVERY_URL ?? profile.mobileRelease.oidcDiscoveryUrl ?? undefined,
			pinningFingerprints: releaseFingerprints(),
			defaultLanguage: RELEASE_DEFAULT_LANGUAGE,
		},
	},
}

export default config
