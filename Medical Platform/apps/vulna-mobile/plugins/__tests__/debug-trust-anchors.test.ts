import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const load = createRequire(__filename)
const { networkSecurityConfigXml, withAttribute } = load("../with-debug-trust-anchors.js") as {
	networkSecurityConfigXml: () => string
	withAttribute: (manifest: string) => string
}

const DEBUG_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:usesCleartextTraffic="true" tools:targetApi="28" />
</manifest>`

describe("debug trust anchors of the Android app", () => {
	it("CAP-010-S01 trusts user certificate authorities next to the system ones, in debug only", () => {
		const xml = networkSecurityConfigXml()
		expect(xml).toContain('<certificates src="system" />')
		expect(xml).toContain('<certificates src="user" />')
		expect(xml).not.toContain("debug-overrides")
	})

	it("points the debug manifest at the configuration once", () => {
		const once = withAttribute(DEBUG_MANIFEST)
		expect(once).toContain('android:networkSecurityConfig="@xml/network_security_config"')
		expect(withAttribute(once)).toBe(once)
	})
})
