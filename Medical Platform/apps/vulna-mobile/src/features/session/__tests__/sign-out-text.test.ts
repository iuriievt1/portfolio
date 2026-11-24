import { ACQUISITION_KIND, type AcquisitionKind, PATIENT_SEX } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import cs from "../../../i18n/cs.json"
import en from "../../../i18n/en.json"
import type { Texts } from "../../../i18n/texts"
import { unclosedDraftsTextOf, unclosedDraftTextOf, uploadingTextOf } from "../sign-out-text"

function draft(kind: AcquisitionKind, fileCount: number): AcquisitionDraftSummary {
	return {
		acquisition_id: "00000000-0000-4000-8000-000000000001",
		kind,
		patient: {
			patient_id: "00000000-0000-4000-8000-000000000002",
			identifiers: [{ system: "urn:mou:patient", value: "0074519" }],
			sex: PATIENT_SEX.FEMALE,
		},
		encounter_id: "00000000-0000-4000-8000-000000000003",
		file_count: fileCount,
		started_at: "2026-10-16T06:30:00Z",
		updated_at: "2026-10-16T06:42:00Z",
		rejected_file_count: 0,
		reminder_due: false,
	}
}

describe("warning about an unclosed record E40", () => {
	it("CAP-015-S09 names the images of the record and offers to close, leave or discard it", () => {
		expect(unclosedDraftTextOf(draft(ACQUISITION_KIND.PHOTO, 3), true, cs)).toBe(
			"Záznam s 3 snímky ještě není uzavřený. Server ho má a zůstane vám — uzavřete ho přes souhrn, odejděte a pokračujte později, nebo ho zahoďte.",
		)
	})

	it("CAP-015-R28 declines one image, a page and a record with nothing in it", () => {
		expect(unclosedDraftTextOf(draft(ACQUISITION_KIND.PHOTO, 1), true, cs)).toMatch(/^Záznam s 1 snímkem /)
		expect(unclosedDraftTextOf(draft(ACQUISITION_KIND.SCAN, 2), true, cs)).toMatch(/^Záznam s 2 stranami /)
		expect(unclosedDraftTextOf(draft(ACQUISITION_KIND.PHOTO, 0), true, cs)).toMatch(/^Záznam bez snímků /)
		expect(unclosedDraftTextOf(draft(ACQUISITION_KIND.PHOTO, 1), true, en as Texts)).toMatch(
			/^The record with 1 image /,
		)
	})

	it("CAP-012-R25 does not offer the discard the server refuses to an outdated app", () => {
		expect(unclosedDraftTextOf(draft(ACQUISITION_KIND.PHOTO, 3), false, cs)).toBe(
			"Záznam s 3 snímky ještě není uzavřený. Server ho má a zůstane vám — uzavřete ho přes souhrn, nebo odejděte a pokračujte později.",
		)
	})

	it("CAP-015-R16 warns once about several unclosed records", () => {
		expect(unclosedDraftsTextOf(2, cs)).toBe("Máte 2 neuzavřené záznamy. Server je má a zůstanou vám.")
		expect(unclosedDraftsTextOf(5, cs)).toBe("Máte 5 neuzavřených záznamů. Server je má a zůstanou vám.")
	})
})

describe("sign-out while own files upload E53", () => {
	it("CAP-002-S12 says how many files the server misses and what to do when one must leave", () => {
		expect(uploadingTextOf(2, false, cs)).toBe(
			"Server ještě nepřijal 2 soubory, které se z tohoto zařízení nahrávají. Odhlásit se můžete, až je přijme.\n\nNechte zařízení zamknout. Přihlášení skončí samo po uplynutí délky relace, nebo když se přihlásí kolega. Soubory se nahrávají dál i potom.",
		)
	})

	it("CAP-015-R28 declines one file and many files", () => {
		expect(uploadingTextOf(1, false, cs)).toMatch(
			/^Server ještě nepřijal 1 soubor, který se z tohoto zařízení nahrává\./,
		)
		expect(uploadingTextOf(5, false, cs)).toMatch(/^Server ještě nepřijal 5 souborů, které /)
	})

	it("CAP-019-R29 CAP-019-S21 adds that a confirmed summary closes only after the next sign-in on this device", () => {
		expect(uploadingTextOf(1, true, cs)).toMatch(
			/Soubory se nahrávají dál i potom\. Záznam, jehož souhrn jste potvrdili, se pak uzavře až po vašem dalším přihlášení na tomto zařízení\.$/,
		)
	})
})
