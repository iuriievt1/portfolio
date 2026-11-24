import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const CORE_MOBILE_SOURCE = new URL("../../libs/core/mobile/src/index.ts", import.meta.url).href

export default defineConfig({
	resolve: {
		alias: { "@ansora/core-mobile": fileURLToPath(CORE_MOBILE_SOURCE) },
		dedupe: ["expo", "react-native"],
	},
})
