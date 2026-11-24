import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { constants, Dataset, requests } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it } from "vitest"
import { COMMAND_FIELD, STATUS } from "../dimse"
import { EXPLICIT_VR_LITTLE_ENDIAN, JPEG_BASELINE, SECONDARY_CAPTURE_IMAGE_STORAGE } from "../uids"
import { hexWord } from "../wire/recorder"
import { against, closePeers } from "./fork-peer"
import { syntheticPart10 } from "./part10"
import { sha256 } from "./support"

// ADR-005 ř. 22, 23, ADR-017, CAP-023-R15, CAP-023-R16, integrace-dicom.md 3, 9.1

const PIXEL_BYTES = 40_000
const C_STORE_RQ = hexWord(COMMAND_FIELD.C_STORE_RQ)
const C_STORE_RSP = hexWord(COMMAND_FIELD.C_STORE_RSP)
const PEER_SILENCE_TIMEOUT_MS = 500

describe("@veevoy/dcmjs-dimse sends stored bytes unchanged, read from the wire by our own decoder", () => {
	let directory: string | undefined

	afterEach(() => {
		closePeers()
		if (directory !== undefined) {
			rmSync(directory, { recursive: true, force: true })
			directory = undefined
		}
	})

	async function storedOnTheWire(datasetOrFile: (part10: Buffer) => Dataset | string) {
		const part10 = syntheticPart10(JPEG_BASELINE, PIXEL_BYTES)
		const stored = Dataset.fromStoredPart10(part10).getStoredDataset()
		const request = new requests.CStoreRequest(datasetOrFile(part10))
		const { record } = await against("BASELINE", request)
		const sent = record.messages.find((message) => message.command?.commandField === C_STORE_RQ)
		return { stored, request, record, sent }
	}

	function storedFile(part10: Buffer): string {
		directory = mkdtempSync(join(tmpdir(), "fork-store-"))
		const file = join(directory, "stored.dcm")
		writeFileSync(file, part10)
		return file
	}

	it("a stored dataset goes on the wire as stored", async () => {
		const { stored, record, sent } = await storedOnTheWire((part10) => Dataset.fromStoredPart10(part10))

		expect(sent?.dataset?.bytes).toBe(stored.length)
		expect(sent?.dataset?.sha256).toBe(sha256(stored))
		expect(sent?.transferSyntax).toBe(JPEG_BASELINE)
		expect(record.messages.find((message) => message.command?.commandField === C_STORE_RSP)?.command?.statusHex).toBe(
			hexWord(STATUS.SUCCESS),
		)
	})

	it("a part10 file goes on the wire as stored", async () => {
		const { stored, sent } = await storedOnTheWire(storedFile)

		expect(sent?.dataset?.sha256).toBe(sha256(stored))
	})

	it("integrace-dicom.md 6.2, 9.1 reports the SHA-256 of the dataset bytes that went on the wire", async () => {
		const { request, sent } = await storedOnTheWire(storedFile)

		expect(request.getSentDatasetSha256()).toBe(sent?.dataset?.sha256)
		expect(request.getDatasetBytesSent()).toBe(sent?.dataset?.bytes)
	})

	it("integrace-dicom.md 3 proposes its own presentation context with only the stored transfer syntax", async () => {
		const { record } = await storedOnTheWire((part10) => Dataset.fromStoredPart10(part10))

		expect(
			record.association.request?.presentationContexts.filter(
				(context) => context.abstractSyntax === SECONDARY_CAPTURE_IMAGE_STORAGE,
			),
		).toEqual([
			{ id: expect.any(Number), abstractSyntax: SECONDARY_CAPTURE_IMAGE_STORAGE, transferSyntaxes: [JPEG_BASELINE] },
		])
	})
})

describe("@veevoy/dcmjs-dimse proposes a presentation context for each variant, read from the wire by our own decoder", () => {
	afterEach(closePeers)

	async function variantsOnTheWire(calledAeTitle: string) {
		const sopInstanceUid = Dataset.generateDerivedUid()
		const variants = [JPEG_BASELINE, EXPLICIT_VR_LITTLE_ENDIAN].map((transferSyntaxUid) =>
			Dataset.fromStoredPart10(syntheticPart10(transferSyntaxUid, PIXEL_BYTES, sopInstanceUid)),
		)
		const { outcome, record } = await against(calledAeTitle, new requests.CStoreRequest(variants), {
			acseTimeout: PEER_SILENCE_TIMEOUT_MS,
			dimseTimeout: PEER_SILENCE_TIMEOUT_MS,
		})
		const storeContexts =
			record.association.request?.presentationContexts.filter(
				(context) => context.abstractSyntax === SECONDARY_CAPTURE_IMAGE_STORAGE,
			) ?? []
		const stores = record.messages.filter(
			(message) => message.direction === "client-to-peer" && message.command?.commandField === C_STORE_RQ,
		)
		return { variants, outcome, record, storeContexts, stores }
	}

	it("CAP-023-R15 proposes one context per variant in order of preference and sends the preferred variant once", async () => {
		const { variants, outcome, storeContexts, stores } = await variantsOnTheWire("BASELINE")

		expect(storeContexts).toEqual([
			{ id: expect.any(Number), abstractSyntax: SECONDARY_CAPTURE_IMAGE_STORAGE, transferSyntaxes: [JPEG_BASELINE] },
			{
				id: expect.any(Number),
				abstractSyntax: SECONDARY_CAPTURE_IMAGE_STORAGE,
				transferSyntaxes: [EXPLICIT_VR_LITTLE_ENDIAN],
			},
		])
		expect(stores).toHaveLength(1)
		expect(stores[0]?.contextId).toBe(storeContexts[0]?.id)
		expect(stores[0]?.transferSyntax).toBe(JPEG_BASELINE)
		expect(stores[0]?.dataset?.sha256).toBe(sha256(variants[0]?.getStoredDataset() ?? Buffer.alloc(0)))
		expect(outcome.events).toEqual([["done"]])
		expect(outcome.networkError).toBeUndefined()
	})

	it("CAP-023-R16 sends no dataset byte when the peer accepts the contexts with a transfer syntax that was not proposed", async () => {
		const { outcome, record, stores } = await variantsOnTheWire("AC-UNPROPOSED-TS")

		expect(stores).toHaveLength(0)
		expect(record.clientToPeer.pduCounts["P-DATA-TF"]).toBeUndefined()
		expect(outcome.events).toEqual([[constants.NotSentReason.NoAcceptedPresentationContext, "done"]])
	})

	it("ignores an answer for a context that was not proposed and sends the next accepted variant", async () => {
		const { variants, outcome, storeContexts, stores } = await variantsOnTheWire("AC-UNPROPOSED-ID")

		expect(stores).toHaveLength(1)
		expect(stores[0]?.contextId).toBe(storeContexts[1]?.id)
		expect(stores[0]?.transferSyntax).toBe(EXPLICIT_VR_LITTLE_ENDIAN)
		expect(stores[0]?.complete).toBe(true)
		expect(stores[0]?.dataset?.sha256).toBe(sha256(variants[1]?.getStoredDataset() ?? Buffer.alloc(0)))
		expect(outcome.events).toEqual([["done"]])
	})
})
