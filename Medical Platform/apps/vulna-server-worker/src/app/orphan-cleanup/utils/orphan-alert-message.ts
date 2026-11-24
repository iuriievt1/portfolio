const CZECH = "cs"

const PLURAL_RULES = new Intl.PluralRules(CZECH)

// stavy-a-mikrocopy.md E67
const ORPHANED_OBJECTS: Readonly<Record<Intl.LDMLPluralRule, string>> = {
	zero: "osiřelých objektů",
	one: "osiřelý objekt",
	two: "osiřelé objekty",
	few: "osiřelé objekty",
	many: "osiřelých objektů",
	other: "osiřelých objektů",
}

// CAP-026-R14, CAP-026-S07, stavy-a-mikrocopy.md E67
export function orphanAlertMessageOf(setAsideCount: number): string {
	const objects = ORPHANED_OBJECTS[PLURAL_RULES.select(setAsideCount)]
	return (
		`Úklidová úloha odložila ${setAsideCount} ${objects}. ` +
		"Na objekty neodkazuje žádné pořízení ani artefakt a jsou starší než nastavená mez. " +
		"Nic se nesmazalo. Rozhodněte, zda je smazat."
	)
}
