import { DIMSE_PHASE, ForkDimseClient, type StoredArtifact } from "@ansora/vulna-adapter-dicom-dimse"
import { TRANSFER_SYNTAX } from "@ansora/vulna-projection-dicom"
import { log } from "@veevoy/dcmjs-dimse"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { COMMAND_FIELD, STATUS } from "../dimse"
import { BLANK_PAGE, documentArtifact, imageArtifact, scanPage, sitesOfEveryRegion } from "../objects/synthetic-objects"
import { CLIENT_IMPLEMENTATION_CLASS_UID } from "../synthetic"
import { hexWord } from "../wire/recorder"
import { targetAt } from "./adapter-support"
import { closePeers, startPeer } from "./fork-peer"

// integrace-dicom.md 6.1, dorucovaci-jadro.md 3, ADR-005 ř. 22, 23, ADR-017

const C_STORE_RQ = hexWord(COMMAND_FIELD.C_STORE_RQ)
const SUCCESS_HEX = hexWord(STATUS.SUCCESS)
const TEST_TIMEOUT_MS = 30_000
const IMPLEMENTATION_VERSION_NAME = "VULNA_TEST"

const client = new ForkDimseClient({
	implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID,
	implementationVersionName: IMPLEMENTATION_VERSION_NAME,
})

async function stored(artifact: StoredArtifact) {
	const peer = await startPeer()
	const result = await client.store(targetAt(peer.port, "BASELINE"), artifact)
	peer.resume()
	const record = await peer.record
	return { result, stores: record.messages.filter((message) => message.command?.commandField === C_STORE_RQ) }
}

describe("the DICOM projection builds artifacts the DIMSE adapter stores byte for byte", () => {
	beforeAll(() => {
		log.setLevel("error")
	})

	afterEach(() => {
		closePeers()
	})

	it(
		"CAP-021-S02 sends the image once in JPEG Baseline with the SHA-256 the builder recorded",
		async () => {
			const site = sitesOfEveryRegion()[0]?.site
			if (site === undefined) {
				throw new Error("the current body diagram has no drawn region")
			}
			const artifact = imageArtifact(site, scanPage(BLANK_PAGE))
			const { result, stores } = await stored(artifact)

			expect(result.phase).toBe(DIMSE_PHASE.RESPONSE)
			expect(result.statusHex).toBe(SUCCESS_HEX)
			expect(result.acceptedTransferSyntax).toBe(TRANSFER_SYNTAX.JPEG_BASELINE)
			expect(result.sentDatasetSha256).toBe(artifact.variants[0]?.datasetSha256)
			expect(stores).toHaveLength(1)
			expect(stores[0]?.dataset?.sha256).toBe(artifact.variants[0]?.datasetSha256)
		},
		TEST_TIMEOUT_MS,
	)

	it(
		"CAP-023-R15 sends the scanned document once, in the variant whose context the peer accepted",
		async () => {
			const artifact = documentArtifact()
			const { result, stores } = await stored(artifact)
			const accepted = artifact.variants.find((variant) => variant.transferSyntaxUid === result.acceptedTransferSyntax)

			expect(result.phase).toBe(DIMSE_PHASE.RESPONSE)
			expect(result.statusHex).toBe(SUCCESS_HEX)
			expect(stores).toHaveLength(1)
			expect(stores[0]?.dataset?.sha256).toBe(accepted?.datasetSha256)
		},
		TEST_TIMEOUT_MS,
	)
})
