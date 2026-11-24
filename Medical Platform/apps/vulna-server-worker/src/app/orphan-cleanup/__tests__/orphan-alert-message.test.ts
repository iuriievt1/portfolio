import { describe, expect, it } from "vitest"
import { orphanAlertMessageOf } from "../utils/orphan-alert-message"

const EXPLANATION =
	"Na objekty neodkazuje žádné pořízení ani artefakt a jsou starší než nastavená mez. " +
	"Nic se nesmazalo. Rozhodněte, zda je smazat."

describe("the alert about set-aside orphaned objects stavy-a-mikrocopy.md E67", () => {
	it.each([
		[1, "1 osiřelý objekt"],
		[2, "2 osiřelé objekty"],
		[4, "4 osiřelé objekty"],
		[5, "5 osiřelých objektů"],
		[21, "21 osiřelých objektů"],
		[22, "22 osiřelých objektů"],
		[500, "500 osiřelých objektů"],
	])("CAP-026-R14 names %i set-aside objects in Czech", (count, objects) => {
		expect(orphanAlertMessageOf(count)).toBe(`Úklidová úloha odložila ${objects}. ${EXPLANATION}`)
	})
})
