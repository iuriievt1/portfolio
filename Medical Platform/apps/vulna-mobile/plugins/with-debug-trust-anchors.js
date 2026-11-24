const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs")
const { join } = require("node:path")
const { withDangerousMod } = require("expo/config-plugins")

const RESOURCE = "network_security_config"
const ATTRIBUTE = `android:networkSecurityConfig="@xml/${RESOURCE}"`

/**
 * Debug builds trust the certificate authorities the user installed, so the emulator can reach the
 * dev TLS server whose dev CA stands in for the customer's CA ✓ CAP-010, NAB-615. The file lives in
 * the debug source set only: release builds keep the system trust store and no cleartext.
 * Cleartext stays allowed in debug as Expo's own debug manifest has it, for the plain http API.
 */
function networkSecurityConfigXml() {
	return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
	<base-config cleartextTrafficPermitted="true">
		<trust-anchors>
			<certificates src="system" />
			<certificates src="user" />
		</trust-anchors>
	</base-config>
</network-security-config>
`
}

function withAttribute(manifest) {
	if (manifest.includes(ATTRIBUTE)) {
		return manifest
	}
	return manifest.replace("<application ", `<application ${ATTRIBUTE} `)
}

function writeDebugTrustAnchors(config) {
	return withDangerousMod(config, [
		"android",
		(modified) => {
			const debugSourceSet = join(modified.modRequest.platformProjectRoot, "app/src/debug")
			const resources = join(debugSourceSet, "res/xml")
			mkdirSync(resources, { recursive: true })
			writeFileSync(join(resources, `${RESOURCE}.xml`), networkSecurityConfigXml(), "utf8")
			const manifestPath = join(debugSourceSet, "AndroidManifest.xml")
			if (!existsSync(manifestPath)) {
				throw new Error(`The debug manifest is missing at ${manifestPath}`)
			}
			writeFileSync(manifestPath, withAttribute(readFileSync(manifestPath, "utf8")), "utf8")
			return modified
		},
	])
}

module.exports = writeDebugTrustAnchors
module.exports.networkSecurityConfigXml = networkSecurityConfigXml
module.exports.withAttribute = withAttribute
