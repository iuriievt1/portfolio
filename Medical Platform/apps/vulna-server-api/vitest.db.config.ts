import { defineConfig } from "vitest/config"

// ADR-024, ADR-021
export default defineConfig({
	test: {
		include: ["src/**/*.db.test.ts"],
		testTimeout: 30_000,
		fileParallelism: false,
	},
})
