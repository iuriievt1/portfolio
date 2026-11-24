const { withPodfile } = require("expo/config-plugins")

const REACT_NATIVE_POST_INSTALL_END = `      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
`
const NITRO_HEADERS_FOR_ZXING = `    installer.pods_project.targets.each do |target|
      next unless target.name == 'VisionCameraZxing'
      target.build_configurations.each do |configuration|
        paths = Array(configuration.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)')
        configuration.build_settings['HEADER_SEARCH_PATHS'] = paths | ['"$(PODS_ROOT)/Headers/Public/NitroModules"']
      end
    end
`

function withNitroHeaders(podfile) {
	if (podfile.includes(NITRO_HEADERS_FOR_ZXING)) {
		return podfile
	}
	if (!podfile.includes(REACT_NATIVE_POST_INSTALL_END)) {
		throw new Error(
			"with-zxing-nitro-headers: the Podfile no longer ends react_native_post_install the way this plugin expects",
		)
	}
	return podfile.replace(REACT_NATIVE_POST_INSTALL_END, (end) => `${end}${NITRO_HEADERS_FOR_ZXING}`)
}

module.exports = (config) =>
	withPodfile(config, (podfile) => {
		podfile.modResults.contents = withNitroHeaders(podfile.modResults.contents)
		return podfile
	})
module.exports.withNitroHeaders = withNitroHeaders
