const { mkdirSync, writeFileSync } = require("node:fs")
const { join } = require("node:path")
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require("expo/config-plugins")

const RESOURCE = "app_restrictions"
const META_DATA_NAME = "android.content.APP_RESTRICTIONS"

/**
 * Keys the app reads from managed configuration ✓ `docs/spec/konfigurace-a-profily.md` kap. 4.
 * A key the app does not read has no place here — the administrator would fill in a value
 * that changes nothing.
 */
const KEYS = [
	{
		key: "server_url",
		title: "Adresa integračního serveru",
		description: "Adresa https, na kterou se aplikace připojuje. Bez klíče platí hodnota z vydání aplikace.",
	},
	{
		key: "oidc_discovery_url",
		title: "Adresa discovery identitního poskytovatele",
		description: "Adresa https k metadatům přihlášení. Bez klíče platí hodnota z vydání aplikace.",
	},
	{
		key: "pinning_fingerprints",
		title: "Otisky pro pinning certifikátu serveru",
		description:
			"Primární a záložní otisk SPKI serveru ve tvaru sha256/…, oddělené čárkou nebo mezerou. Bez klíče platí otisky z vydání aplikace.",
	},
	{
		key: "registration_secret",
		title: "Registrační tajemství",
		description: "Řetězec, kterým se spravované zařízení prokáže při registraci a server ho schválí rovnou.",
	},
	{
		key: "group_code",
		title: "Kód skupiny zařízení",
		description: "Předvolba zařazení do skupiny. Server ji použije jen se správným registračním tajemstvím.",
	},
]

function titleName(key) {
	return `restriction_${key}_title`
}

function descriptionName(key) {
	return `restriction_${key}_description`
}

// Android reads the labels as string resources, never as literals in the schema.
function addLabels(config) {
	return withStringsXml(config, (modified) => {
		for (const entry of KEYS) {
			modified.modResults = AndroidConfig.Strings.setStringItem(
				[
					{ $: { name: titleName(entry.key), translatable: "false" }, _: entry.title },
					{ $: { name: descriptionName(entry.key), translatable: "false" }, _: entry.description },
				],
				modified.modResults,
			)
		}
		return modified
	})
}

function restrictionsXml() {
	const entries = KEYS.map(
		(entry) =>
			`\t<restriction\n\t\tandroid:key="${entry.key}"\n\t\tandroid:title="@string/${titleName(entry.key)}"\n\t\tandroid:description="@string/${descriptionName(entry.key)}"\n\t\tandroid:restrictionType="string"\n\t\tandroid:defaultValue="" />`,
	).join("\n")
	return `<?xml version="1.0" encoding="utf-8"?>\n<restrictions xmlns:android="http://schemas.android.com/apk/res/android">\n${entries}\n</restrictions>\n`
}

function writeSchema(config) {
	return withDangerousMod(config, [
		"android",
		(modified) => {
			const directory = join(modified.modRequest.platformProjectRoot, "app/src/main/res/xml")
			mkdirSync(directory, { recursive: true })
			writeFileSync(join(directory, `${RESOURCE}.xml`), restrictionsXml(), "utf8")
			return modified
		},
	])
}

function announceSchema(config) {
	return withAndroidManifest(config, (modified) => {
		const application = AndroidConfig.Manifest.getMainApplicationOrThrow(modified.modResults)
		AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, META_DATA_NAME, `@xml/${RESOURCE}`, "resource")
		return modified
	})
}

module.exports = (config) => announceSchema(addLabels(writeSchema(config)))
