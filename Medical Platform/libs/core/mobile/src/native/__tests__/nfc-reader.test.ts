import { PATIENT_TAG_SOURCE } from "@ansora/contracts"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CARD_READING, nfcReader } from "../nfc-reader"

const INSTRUCTION = "Přiložte štítek."

const tag = vi.hoisted(() => {
	class NfcErrorBase extends Error {}
	return {
		id: "E00401500000ABCD",
		textRecordType: "T",
		wellKnown: 1,
		errors: {
			UserCancel: class extends NfcErrorBase {},
			Timeout: class extends NfcErrorBase {},
			ZeroLengthMessage: class extends NfcErrorBase {},
			TagConnectionLost: class extends NfcErrorBase {},
		},
		status: { NotSupported: 1, ReadWrite: 2, ReadOnly: 3 },
		ndefStatus: 2,
		records: [] as { tnf: number; type: string; payload: number[] }[],
		readingFailure: undefined as Error | undefined,
		messageRequests: 0,
	}
})

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }))

vi.mock("../screen-privacy", () => ({ screenPrivacy: () => ({ allowSystemSheet: () => undefined }) }))

vi.mock("react-native-nfc-manager", () => ({
	default: {
		start: async () => undefined,
		requestTechnology: async () => undefined,
		getTag: async () => ({ id: tag.id }),
		cancelTechnologyRequest: async () => undefined,
		ndefHandler: {
			getNdefStatus: async () => ({ status: tag.ndefStatus, capacity: 0 }),
			getNdefMessage: async () => {
				tag.messageRequests += 1
				if (tag.readingFailure !== undefined) {
					throw tag.readingFailure
				}
				return { ndefMessage: tag.records }
			},
		},
	},
	Ndef: {
		TNF_WELL_KNOWN: tag.wellKnown,
		RTD_TEXT: tag.textRecordType,
		isType: (record: { tnf: number; type: string }, tnf: number, type: string) =>
			record.tnf === tnf && record.type === type,
		text: { decodePayload: (payload: Uint8Array) => new TextDecoder().decode(payload) },
	},
	NdefStatus: tag.status,
	NfcError: tag.errors,
	NfcTech: { MifareIOS: "mifare", Iso15693IOS: "iso15693", Ndef: "Ndef", NfcA: "NfcA" },
}))

function textRecord(text: string) {
	return { tnf: tag.wellKnown, type: tag.textRecordType, payload: [...new TextEncoder().encode(text)] }
}

async function readPatientTag() {
	return await nfcReader().readTag(INSTRUCTION, PATIENT_TAG_SOURCE.NDEF_TEXT)
}

describe("CAP-013-R05 a patient tag read on iOS", () => {
	beforeEach(() => {
		tag.ndefStatus = tag.status.ReadWrite
		tag.records = []
		tag.readingFailure = undefined
		tag.messageRequests = 0
	})

	it("reads a blank tag as a tag without text, not as a failed reading", async () => {
		tag.readingFailure = new tag.errors.ZeroLengthMessage()

		expect(await readPatientTag()).toEqual({ kind: CARD_READING.READ, tagId: tag.id, ndefTexts: [] })
	})

	it("reads a tag without NDEF formatting without asking for its message", async () => {
		tag.ndefStatus = tag.status.NotSupported

		expect(await readPatientTag()).toEqual({ kind: CARD_READING.READ, tagId: tag.id, ndefTexts: [] })
		expect(tag.messageRequests).toBe(0)
	})

	it("gives the text a written tag carries", async () => {
		tag.records = [textRecord("8001011234")]

		expect(await readPatientTag()).toEqual({ kind: CARD_READING.READ, tagId: tag.id, ndefTexts: ["8001011234"] })
	})

	it("still fails when the tag is lost during the reading", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined)
		tag.readingFailure = new tag.errors.TagConnectionLost()

		expect(await readPatientTag()).toEqual({ kind: CARD_READING.FAILED })
	})
})
