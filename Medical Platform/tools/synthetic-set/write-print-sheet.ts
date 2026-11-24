import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { printSheetPdf, woundsJson } from "./print-sheet"
import { PRINT_SHEET_FILE, WOUNDS_DIRECTORY, WOUNDS_FILE } from "./set-paths"

function main(): void {
	mkdirSync(WOUNDS_DIRECTORY, { recursive: true })
	writeFileSync(join(WOUNDS_DIRECTORY, PRINT_SHEET_FILE), printSheetPdf())
	writeFileSync(join(WOUNDS_DIRECTORY, WOUNDS_FILE), woundsJson())
	process.stdout.write(`synthetic set: print sheet and wounds written to ${WOUNDS_DIRECTORY}\n`)
}

main()
