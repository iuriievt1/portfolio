import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const load = createRequire(__filename)
const { withNitroHeaders } = load("../with-zxing-nitro-headers.js") as {
	withNitroHeaders: (podfile: string) => string
}

const POST_INSTALL = `  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`

describe("Nitro headers for the barcode scanner pod", () => {
	it("adds the public Nitro headers to the scanner target only, keeping its paths, after React Native's own setup", () => {
		const podfile = withNitroHeaders(POST_INSTALL)

		expect(podfile).toContain("next unless target.name == 'VisionCameraZxing'")
		expect(podfile).toContain("paths | ['\"$(PODS_ROOT)/Headers/Public/NitroModules\"']")
		expect(podfile).toContain("Array(configuration.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)')")
		expect(podfile.indexOf("react_native_post_install(")).toBeLessThan(podfile.indexOf("VisionCameraZxing"))
		expect(podfile.endsWith("    end\n  end\nend\n")).toBe(true)
	})

	it("adds the headers once", () => {
		const once = withNitroHeaders(POST_INSTALL)

		expect(withNitroHeaders(once)).toBe(once)
	})

	it("stops the build when the Podfile no longer ends React Native's setup as expected", () => {
		expect(() => withNitroHeaders("platform :ios, '16.4'\n")).toThrow("with-zxing-nitro-headers")
	})
})
