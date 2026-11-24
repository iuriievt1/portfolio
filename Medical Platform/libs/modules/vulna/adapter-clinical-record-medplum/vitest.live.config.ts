import { defineConfig } from "vitest/config"

// ADR-053 bod 10, ADR-024
export default defineConfig({
	test: {
		include: ["src/**/*.live.test.ts"],
		testTimeout: 60_000,
		hookTimeout: 120_000,
	},
})
