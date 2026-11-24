import { requests } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it } from "vitest"
import { CLIENT_IMPLEMENTATION_CLASS_UID } from "../synthetic"
import { against, closePeers } from "./fork-peer"

// ADR-017, CAP-012-R17, CAP-021-R12, Q-045, integrace-dicom.md 4

const IMPLEMENTATION_VERSION = "VULNA-1.0.0"

describe("@veevoy/dcmjs-dimse identifies itself as the adapter sets it, read from the wire by our own decoder", () => {
	afterEach(closePeers)

	async function requestedWith(options: { implementationVersion?: string }) {
		const { outcome, record } = await against("BASELINE", new requests.CEchoRequest(), options)
		return { outcome, request: record.association.request }
	}

	it("sends the implementation class UID and version name it is given", async () => {
		const { outcome, request } = await requestedWith({ implementationVersion: IMPLEMENTATION_VERSION })

		expect(outcome.networkError).toBeUndefined()
		expect(request?.implementationClassUid).toBe(CLIENT_IMPLEMENTATION_CLASS_UID)
		expect(request?.implementationVersionName).toBe(IMPLEMENTATION_VERSION)
	})

	it("sends no implementation version name of its own when it is given none", async () => {
		const { outcome, request } = await requestedWith({})

		expect(outcome.networkError).toBeUndefined()
		expect(request?.implementationClassUid).toBe(CLIENT_IMPLEMENTATION_CLASS_UID)
		expect(request?.implementationVersionName).toBeUndefined()
	})
})
