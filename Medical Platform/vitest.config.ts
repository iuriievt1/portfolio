import { defineConfig } from "vitest/config"

/**
 * Unit tests of the domain run **without a database and without a network** ✓ ADR-024.
 *
 * A test that verifies a capability scenario names its id (`CAP-002-S03`) in the test name or as
 * a tag — only then is it visible which scenarios exist in code ✓ `docs/README.md`, ADR-024.
 *
 * The globs are relative so the same config works from the workspace root (`pnpm test`) and from
 * a single project, where Nx runs `vitest run` with that project as the working directory.
 */
export default defineConfig({
	test: {
		include: ["**/*.test.ts"],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/.nx/**",
			// ADR-053 bod 10
			"**/*.live.test.ts",
			// ADR-024
			"**/*.db.test.ts",
			// CAP-022-R01
			"**/*.ocr.test.ts",
			// ADR-024
			"**/*.system.test.ts",
			// Aplikace bez jednotkových testů; RN a DOM potřebují vlastní prostředí.
			"**/vulna-mobile/**",
			"**/vulna-admin/**",
		],
		passWithNoTests: true,
	},
})
