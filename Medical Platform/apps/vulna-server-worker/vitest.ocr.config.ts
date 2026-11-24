import { defineConfig } from "vitest/config"

// CAP-022-R01, ADR-024
export default defineConfig({
	test: {
		include: ["src/**/*.ocr.test.ts"],
		hookTimeout: 180_000,
	},
})
