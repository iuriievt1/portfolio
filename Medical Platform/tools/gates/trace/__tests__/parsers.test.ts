import { describe, expect, it } from "vitest"
import { parseCapability } from "../capabilities"
import { parseCompliance } from "../compliance"
import { malformedScenarioIds } from "../ids"
import { parseRegistry } from "../registry"
import { buildRequirements } from "../requirements"
import { testGlobs, testNames } from "../tests"
import { MALFORMED_SCENARIO_ID } from "./fixtures"

const registry = `| id | požadavek | zdroj | typ | plocha | závaznost | verze | poznámka |
|---|---|---|---|---|---|---|---|
| TS-001 | Systém slouží k pořizování. | 2a ř. 151 | funkční | oba | musí | v1 | — |
| NAB-223 | Vlastní relační tokeny. | nab-02a ř. 470 | bezpečnostní | oba | musí | v1 | ⚠ Q-007 |
| SML-300 | Rozvojová položka. | 2b ř. 9 | funkční | oba | může | rozvoj | — |
`

const capability = `---
id: CAP-002
kind: capability
status: current
---
# Relace

## Pravidla

- CAP-002-R01 Mobilní aplikace komunikuje vlastními tokeny; jinak by odebrání přístupu čekalo. ✓ NAB-223,
  NAB-278; podobně ADR-013.
- CAP-002-R02 Bez zdroje.

## Scénáře

#### CAP-002-S01 — token se obnoví

Pokud běží relace,
Když se token obnoví,
Pak audit nese událost (CAP-002-R01, ✓ NAB-434).

#### CAP-002-S02 — bez pravidla

Pokud něco, Když něco, Pak něco.

## Mimo rozsah
`

const compliance = `## 3. Požadavky, které vlastní schopnost

### 3.1 CAP-002 — Relace (2)

| Id | Požadavek | Zdroj | Stav | Poznámka |
|---|---|---|---|---|
| NAB-223 | Vlastní relační tokeny. | nab-02a ř. 470 | pokryto | — |
| NAB-434 | Audit relace. | nab-02a ř. 600 | otevřené | rozpor |

## 4. Požadavky, které nejsou chováním softwaru

### 4.1 Platformní vymezení (1)

**Domov:** \`docs/spec/architektura.md\`

| Id | Požadavek | Zdroj | Stav | Poznámka |
|---|---|---|---|---|
| TS-001 | Systém slouží k pořizování. | 2a ř. 151 | mimo chování | — |

## 5. Sledované rozpory

| TS-999 | ignorováno | x | pokryto | — |
`

describe("trace parsers", () => {
	it("reads v1 and development requirements from a registry table", () => {
		const requirements = parseRegistry(registry)
		expect(requirements.map((requirement) => `${requirement.id}:${requirement.version}`)).toEqual([
			"TS-001:v1",
			"NAB-223:v1",
			"SML-300:rozvoj",
		])
		expect(requirements[1]?.sentence).toBe("Vlastní relační tokeny.")
		expect(requirements[1]?.source).toBe("nab-02a ř. 470")
	})

	it("reads rules with continuation lines and scenarios with their citations", () => {
		const parsed = parseCapability(capability)
		expect(parsed?.id).toBe("CAP-002")
		expect(parsed?.status).toBe("current")
		expect(parsed?.rules).toEqual([
			{ id: "CAP-002-R01", requirements: ["NAB-223", "NAB-278"], decisions: ["ADR-013"] },
			{ id: "CAP-002-R02", requirements: [], decisions: [] },
		])
		expect(parsed?.scenarios).toEqual([
			{ id: "CAP-002-S01", title: "token se obnoví", rules: ["CAP-002-R01"], requirements: ["NAB-434"] },
			{ id: "CAP-002-S02", title: "bez pravidla", rules: [], requirements: [] },
		])
	})

	it("reads ownership and non-behaviour groups from the compliance matrix only", () => {
		const coverage = parseCompliance(compliance)
		expect(coverage.get("NAB-223")).toEqual({ id: "NAB-223", state: "pokryto", capability: "CAP-002" })
		expect(coverage.get("NAB-434")?.state).toBe("otevřené")
		expect(coverage.get("TS-001")).toEqual({ id: "TS-001", state: "mimo chování", home: "`docs/spec/architektura.md`" })
		expect(coverage.has("TS-999")).toBe(false)
	})

	it("assembles requirement records with evidence, rules, scenarios and decisions", () => {
		const parsed = parseCapability(capability)
		const records = buildRequirements(parseRegistry(registry), parsed ? [parsed] : [], parseCompliance(compliance))
		expect(records.map((record) => record.id)).toEqual(["TS-001", "NAB-223"])
		expect(records[0]).toMatchObject({
			evidence: "document",
			home: "`docs/spec/architektura.md`",
			rules: [],
			scenarios: [],
		})
		expect(records[1]).toMatchObject({
			evidence: "test",
			capability: "CAP-002",
			rules: ["CAP-002-R01"],
			scenarios: ["CAP-002-S01"],
			decisions: ["ADR-013"],
		})
	})

	it("reads the test globs from the docs header", () => {
		expect(testGlobs('---\nname: x\ntests: ["libs/**/*.test.ts","apps/**/*.test.ts"]\n---\n')).toEqual([
			"libs/**/*.test.ts",
			"apps/**/*.test.ts",
		])
		expect(testGlobs("---\nname: x\n---\n")).toEqual([])
	})

	it("takes scenario ids from test names only, not from comments or code", () => {
		const source = `// CAP-001-S09 in a comment
describe("CAP-002-S01 session", () => {
	it.each([1])("renews the token CAP-002-S02", () => {})
	test(\`${MALFORMED_SCENARIO_ID} typo\`, () => {})
	const id = "CAP-003-S03"
})`
		const names = testNames(source, "a.test.ts").join("\n")
		expect(names).toContain("CAP-002-S01")
		expect(names).toContain("CAP-002-S02")
		expect(names).not.toContain("CAP-001-S09")
		expect(names).not.toContain("CAP-003-S03")
		expect(malformedScenarioIds(names)).toEqual([MALFORMED_SCENARIO_ID])
	})
})
