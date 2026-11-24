import { defineConfig } from "vitest/config"

// ADR-024, dev/system/run.sh, system/support/limits.ts
const TIMEOUT_MILLISECONDS = 900_000

export default defineConfig({
	test: {
		include: ["system/**/*.system.test.ts"],
		testTimeout: TIMEOUT_MILLISECONDS,
		hookTimeout: TIMEOUT_MILLISECONDS,
		fileParallelism: false,
	},
})
