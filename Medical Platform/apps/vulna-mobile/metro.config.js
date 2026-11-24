const path = require("node:path")
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const workspaceRoot = path.resolve(__dirname, "../..")
const config = getDefaultConfig(__dirname)

// Balíčky workspace (@ansora/*) leží mimo adresář aplikace — Metro je musí vidět.
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
	path.resolve(__dirname, "node_modules"),
	path.resolve(workspaceRoot, "node_modules"),
]

// Tailwind counts spacing in rem and NativeWind puts 14 px there. The design is in pixels.
const DESIGN_REM = 16

const withStyles = withNativeWind(config, { input: "./src/styles/global.css", inlineRem: DESIGN_REM })

// Hoisted pnpm leaves two copies of the NativeWind runtime. The style table is a
// module variable, so the copy that renders screens never sees what the other one
// was given. Everything goes to the copy the Metro plugin writes the styles into.
const STYLE_RUNTIME = "react-native-css-interop"
const styleRuntimeRoot = path.dirname(
	require.resolve(`${STYLE_RUNTIME}/package.json`, {
		paths: [path.dirname(require.resolve("nativewind/package.json", { paths: [__dirname] }))],
	}),
)
const otherCopy = `${path.sep}node_modules${path.sep}${STYLE_RUNTIME}${path.sep}`

const resolveUpstream = withStyles.resolver.resolveRequest

withStyles.resolver.resolveRequest = (context, moduleName, platform) => {
	const resolved = resolveUpstream(context, moduleName, platform)
	if (resolved.type !== "sourceFile") {
		return resolved
	}
	return { ...resolved, filePath: inStyleRuntimeRoot(resolved.filePath) }
}

function inStyleRuntimeRoot(filePath) {
	const copyAt = filePath.lastIndexOf(otherCopy)
	if (copyAt < 0) {
		return filePath
	}
	return path.join(styleRuntimeRoot, filePath.slice(copyAt + otherCopy.length))
}

module.exports = withStyles
