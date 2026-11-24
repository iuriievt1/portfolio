import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError } from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { MedplumBinaryStore } from "../medplum-binary-store"

const BASE_URL = "http://store.invalid/"
const TOKEN_PATH = "oauth2/token"
const BINARY_PATH = "fhir/R4/Binary"
const HTTP_OK = 200
const HTTP_CREATED = 201
const HTTP_BAD_REQUEST = 400
const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404
const HTTP_GONE = 410
const HTTP_SERVER_ERROR = 500
const HTTP_UNAVAILABLE = 503
// FHIR R4 IssueType
const ISSUE_OF_STATUS: Readonly<Record<number, string>> = {
	[HTTP_BAD_REQUEST]: "invalid",
	[HTTP_SERVER_ERROR]: "exception",
}
const ENCOUNTER_ID = "encounter-1"
const CLIENT_ID = "worker"
const BYTES = Buffer.from("bytes of a wound photo")
const PLACEMENT = { contentType: "image/jpeg", ownerReference: `Encounter/${ENCOUNTER_ID}` }
const STREAMED_REQUEST = "half"
const TOKEN_LIFETIME_SECONDS = 3600
const MILLISECONDS_PER_SECOND = 1000

interface Sent {
	method: string
	path: string
	contentType: string | null
	securityContext: string | null
	duplex: string | undefined
	body: Buffer | undefined
}

type StreamedInit = RequestInit & { duplex?: string }

async function bodyOf(init: StreamedInit | undefined): Promise<Buffer | undefined> {
	if (init?.body === undefined || init.body === null) {
		return undefined
	}
	return Buffer.from(await new Response(init.body).arrayBuffer())
}

// RFC 7519
function accessTokenOf(): string {
	const partOf = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
	const expires = Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + TOKEN_LIFETIME_SECONDS
	return `${partOf({ alg: "none" })}.${partOf({ exp: expires, client_id: CLIENT_ID })}.signature`
}

function contentOf(bytes: Buffer): Readable {
	return Readable.from([bytes])
}

function outcome(status: number): Response {
	const code = ISSUE_OF_STATUS[status] ?? "processing"
	return new Response(JSON.stringify({ resourceType: "OperationOutcome", issue: [{ severity: "error", code }] }), {
		status,
		headers: { "content-type": "application/fhir+json" },
	})
}

function storeHarness(options: { uploadStatus?: number; readStatus?: number; readBack?: Buffer } = {}) {
	const sent: Sent[] = []
	let logins = 0
	const fetch = async (input: string | URL | globalThis.Request, init?: StreamedInit): Promise<Response> => {
		const url = String(input)
		if (url.endsWith(TOKEN_PATH)) {
			logins += 1
			const token = { access_token: accessTokenOf(), token_type: "Bearer", expires_in: TOKEN_LIFETIME_SECONDS }
			return new Response(JSON.stringify(token), {
				status: HTTP_OK,
			})
		}
		const headers = new Headers(init?.headers)
		const method = init?.method ?? "GET"
		sent.push({
			method,
			path: url.slice(BASE_URL.length),
			contentType: headers.get("content-type"),
			securityContext: headers.get("x-security-context"),
			duplex: init?.duplex,
			body: await bodyOf(init),
		})
		if (method === "POST") {
			const status = options.uploadStatus ?? HTTP_CREATED
			return status === HTTP_CREATED
				? new Response(JSON.stringify({ resourceType: "Binary", id: "binary-1", contentType: "image/jpeg" }), {
						status,
						headers: { "content-type": "application/fhir+json" },
					})
				: outcome(status)
		}
		const status = options.readStatus ?? HTTP_OK
		return status === HTTP_OK
			? new Response(options.readBack ?? BYTES, { status, headers: { "content-type": "image/jpeg" } })
			: outcome(status)
	}
	const store = new MedplumBinaryStore({ baseUrl: BASE_URL, clientId: CLIENT_ID, clientSecret: "secret", fetch })
	return { store, sent, logins: () => logins }
}

async function failureOf(work: Promise<unknown>): Promise<string> {
	const error = await work.then(
		() => undefined,
		(caught: unknown) => caught,
	)
	if (!(error instanceof ClinicalRecordStoreError)) {
		throw new Error(`expected a store error, got ${String(error)}`)
	}
	return error.failure
}

describe("bytes of a closed record in the clinical record store CAP-021-R36", () => {
	it("backend.md 3.2 streams the bytes in a raw POST Binary bound to the encounter of the record and returns its id", async () => {
		const run = storeHarness()

		const binaryId = await run.store.upload(contentOf(BYTES), PLACEMENT)

		expect(binaryId).toBe("binary-1")
		expect(run.sent).toEqual([
			{
				method: "POST",
				path: BINARY_PATH,
				contentType: "image/jpeg",
				securityContext: `Encounter/${ENCOUNTER_ID}`,
				duplex: STREAMED_REQUEST,
				body: BYTES,
			},
		])
	})

	it("closes the stream of the buffer when the upload fails", async () => {
		const content = contentOf(BYTES)

		await failureOf(storeHarness({ uploadStatus: HTTP_BAD_REQUEST }).store.upload(content, PLACEMENT))

		expect(content.destroyed).toBe(true)
	})

	it("ADR-050 bod 10 keeps a valid access token and signs in again after the store refused it", async () => {
		const accepted = storeHarness()
		const refused = storeHarness({ uploadStatus: HTTP_UNAUTHORIZED })

		await accepted.store.upload(contentOf(BYTES), PLACEMENT)
		await accepted.store.upload(contentOf(BYTES), PLACEMENT)
		expect(await failureOf(refused.store.upload(contentOf(BYTES), PLACEMENT))).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
		await failureOf(refused.store.upload(contentOf(BYTES), PLACEMENT))

		expect(accepted.logins()).toBe(1)
		expect(refused.logins()).toBe(2)
	})

	it("CAP-020-R22 signs no link without the signing key of the object store", async () => {
		const run = storeHarness()

		expect(await failureOf(run.store.downloadLinkOf("binary-1", new Date()))).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
		expect(run.sent).toEqual([])
	})

	it("CAP-021-S29 reads the Binary back and returns the SHA-256 of the bytes the store holds", async () => {
		const run = storeHarness()

		const digest = await run.store.sha256Of("binary-1")

		expect(digest).toBe(createHash("sha256").update(BYTES).digest("hex"))
		expect(run.sent.map((request) => `${request.method} ${request.path}`)).toEqual([`GET ${BINARY_PATH}/binary-1`])
	})

	it("CAP-021-S29 answers nothing for a Binary the store does not hold, so the upload starts anew", async () => {
		expect(await storeHarness({ readStatus: HTTP_NOT_FOUND }).store.sha256Of("binary-gone")).toBeUndefined()
		expect(await storeHarness({ readStatus: HTTP_GONE }).store.sha256Of("binary-deleted")).toBeUndefined()
	})

	it("CAP-021-S27 never takes an error page for the bytes: an unavailable store on read-back is a wait", async () => {
		expect(await failureOf(storeHarness({ readStatus: HTTP_UNAVAILABLE }).store.sha256Of("binary-1"))).toBe(
			CLINICAL_RECORD_FAILURE.UNAVAILABLE,
		)
		expect(await failureOf(storeHarness({ readStatus: HTTP_FORBIDDEN }).store.sha256Of("binary-1"))).toBe(
			CLINICAL_RECORD_FAILURE.REJECTED,
		)
	})

	it("CAP-021-R36 takes a refused upload as a rejection and a failing store as a wait", async () => {
		const uploadFailureOf = async (status: number) =>
			await failureOf(storeHarness({ uploadStatus: status }).store.upload(contentOf(BYTES), PLACEMENT))

		expect(await uploadFailureOf(HTTP_BAD_REQUEST)).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
		expect(await uploadFailureOf(HTTP_FORBIDDEN)).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
		expect(await uploadFailureOf(HTTP_SERVER_ERROR)).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
		expect(await uploadFailureOf(HTTP_UNAVAILABLE)).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
	})
})

describe("removal of a Binary after the retention CAP-026-R19, backend.md 3.1 T8, dorucovaci-jadro.md 6", () => {
	it("CAP-026-S17 removes the Binary with its versions and checks that the store holds it no longer", async () => {
		const run = storeHarness({ readStatus: HTTP_NOT_FOUND })

		await run.store.removeWithVersions("binary-1")

		expect(run.sent.map((sent) => `${sent.method} ${sent.path}`)).toEqual([
			`POST ${BINARY_PATH}/binary-1/$expunge`,
			`GET ${BINARY_PATH}/binary-1`,
		])
	})

	it("dorucovaci-jadro.md 6 takes a Binary already gone as removed, so a repeated run is harmless", async () => {
		const run = storeHarness({ readStatus: HTTP_GONE })

		await expect(run.store.removeWithVersions("binary-1")).resolves.toBeUndefined()
	})

	it("CAP-026-R19 does not take a Binary the store still holds as removed", async () => {
		const run = storeHarness({ readStatus: HTTP_OK })

		expect(await failureOf(run.store.removeWithVersions("binary-1"))).toBe(CLINICAL_RECORD_FAILURE.UNKNOWN)
	})

	it("CAP-026-R19 takes a refused removal as a rejection and a failing store as a wait", async () => {
		expect(await failureOf(storeHarness({ uploadStatus: HTTP_FORBIDDEN }).store.removeWithVersions("binary-1"))).toBe(
			CLINICAL_RECORD_FAILURE.REJECTED,
		)
		expect(await failureOf(storeHarness({ uploadStatus: HTTP_UNAVAILABLE }).store.removeWithVersions("binary-1"))).toBe(
			CLINICAL_RECORD_FAILURE.UNAVAILABLE,
		)
	})
})
