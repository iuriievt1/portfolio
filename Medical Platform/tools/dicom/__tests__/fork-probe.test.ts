import { association, type Client, constants, requests } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it } from "vitest"
import { SYNTHETIC_PATIENT_ID } from "../synthetic"
import { against, closePeers } from "./fork-peer"

// integrace-dicom.md 6.1, PS3.8 9.3.2.2, CS ř. 1618, 2401

const { AssociationOutcome, SopClass, StorageClass, TransferSyntax } = constants
const PLACEHOLDER_CONTEXT_ID = 1
const PROPOSALS = [
	{ abstractSyntax: SopClass.Verification, transferSyntaxes: [TransferSyntax.ImplicitVRLittleEndian] },
	{
		abstractSyntax: StorageClass.SecondaryCaptureImageStorage,
		transferSyntaxes: [TransferSyntax.JpegBaseline, TransferSyntax.ExplicitVRLittleEndian],
	},
]

function proposeContexts(client: Client): void {
	for (const proposal of PROPOSALS) {
		const context = new association.PresentationContext(PLACEHOLDER_CONTEXT_ID, proposal.abstractSyntax)
		for (const transferSyntax of proposal.transferSyntaxes) {
			context.addTransferSyntaxUid(transferSyntax)
		}
		client.addAdditionalPresentationContext(context, true)
	}
}

describe("@veevoy/dcmjs-dimse negotiates presentation contexts without requests, read from the wire by our own decoder", () => {
	afterEach(closePeers)

	it("integrace-dicom.md 6.1 proposes the contexts, sends no data and releases the association", async () => {
		const { outcome, record } = await against("BASELINE", [], {}, proposeContexts)

		expect(outcome.networkError).toBeUndefined()
		expect(outcome.associationsAccepted).toBe(1)
		expect(outcome.end).toEqual({ outcome: AssociationOutcome.Released })
		expect(record.association.request?.presentationContexts).toEqual([
			{ id: 1, ...PROPOSALS[0] },
			{ id: 3, ...PROPOSALS[1] },
		])
		expect(record.messages).toEqual([])
		expect(record.clientToPeer.pduCounts).toEqual({ "A-ASSOCIATE-RQ": 1, "A-RELEASE-RQ": 1 })
		expect(record.association.releaseRequestedBy).toBe("client-to-peer")
	})

	it("integrace-dicom.md 6.1 proposes only the query transfer syntaxes for C-ECHO and C-FIND", async () => {
		const { outcome, record } = await against(
			"BASELINE",
			[new requests.CEchoRequest(), requests.CFindRequest.createStudyFindRequest({ PatientID: SYNTHETIC_PATIENT_ID })],
			{ queryTransferSyntaxes: [TransferSyntax.ImplicitVRLittleEndian] },
		)

		expect(outcome.end).toEqual({ outcome: AssociationOutcome.Released })
		expect(record.association.request?.presentationContexts.map((context) => context.transferSyntaxes)).toEqual([
			[TransferSyntax.ImplicitVRLittleEndian],
			[TransferSyntax.ImplicitVRLittleEndian],
		])
	})
})
