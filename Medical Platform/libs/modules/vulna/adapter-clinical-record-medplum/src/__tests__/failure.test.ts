import { CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError } from "@ansora/vulna-domain/ports"
import {
	badRequest,
	conflict,
	forbidden,
	OperationOutcomeError,
	serverError,
	tooManyRequests,
	unauthorized,
} from "@medplum/core"
import { describe, expect, it } from "vitest"
import { storeErrorOf } from "../failure"
import { breakGlassRulesOf } from "../installation/installation"
import { MedplumClinicalRecordStore } from "../medplum-clinical-record-store"

const OPERATION = "recording the actor"

function failureOf(error: unknown) {
	return storeErrorOf(error, OPERATION).failure
}

describe("store failures ADR-050 bod 10", () => {
	it("retries on 429, 5xx, a serialization conflict and the network", () => {
		expect(failureOf(new OperationOutcomeError(tooManyRequests))).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
		expect(failureOf(new OperationOutcomeError(serverError(new Error("down"))))).toBe(
			CLINICAL_RECORD_FAILURE.UNAVAILABLE,
		)
		expect(failureOf(new OperationOutcomeError(conflict("serialization")))).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
		expect(failureOf(new TypeError("fetch failed"))).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
	})

	it("CAP-021-R27 marks a timeout and a connection lost after sending as an unknown outcome", () => {
		const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError")
		const lost = new TypeError("fetch failed", {
			cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }),
		})
		const reset = new TypeError("fetch failed", {
			cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
		})
		const refused = new TypeError("fetch failed", { cause: new AggregateError([], "connect ECONNREFUSED") })

		expect(failureOf(timeout)).toBe(CLINICAL_RECORD_FAILURE.UNKNOWN)
		expect(failureOf(lost)).toBe(CLINICAL_RECORD_FAILURE.UNKNOWN)
		expect(failureOf(reset)).toBe(CLINICAL_RECORD_FAILURE.UNKNOWN)
		expect(failureOf(refused)).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
	})

	it("waits for a corrected credential instead of giving up on a refused login", () => {
		expect(failureOf(new OperationOutcomeError(unauthorized))).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
	})

	it("CAP-001-S34 waits for a corrected client secret the token endpoint refuses with 400", async () => {
		const refusing = async () =>
			new Response(JSON.stringify({ error: "invalid_request", error_description: "Invalid secret" }), {
				status: 400,
				headers: { "content-type": "application/json" },
			})
		const store = new MedplumClinicalRecordStore({
			baseUrl: "http://store.invalid/",
			clientId: "client",
			clientSecret: "rotated",
			canonicalBase: "https://fhir.example/vulna/",
			instanceBaseUri: "https://fhir.example/instance/",
			serverVersion: "1.0.0",
			fetch: refusing,
		})

		const failure = await store
			.recordActor({ userId: "user", displayName: "User", department: undefined, roles: [] })
			.then(
				() => undefined,
				(error: unknown) => error,
			)

		expect(failure).toBeInstanceOf(ClinicalRecordStoreError)
		expect((failure as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
	})

	it("stops on validation and on a forbidden write", () => {
		expect(failureOf(new OperationOutcomeError(badRequest("invalid")))).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
		expect(failureOf(new OperationOutcomeError(forbidden))).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
	})

	it("keeps a failure the adapter already classified", () => {
		const rejected = new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "no root organization")

		expect(storeErrorOf(rejected, OPERATION)).toBe(rejected)
	})
})

describe("break-glass rules CAP-012-S23, ADR-050 bod 10", () => {
	it("allows the instance network first and blocks everything else", () => {
		expect(breakGlassRulesOf(["10.20.30.", "127.0.0.1"])).toEqual([
			{ name: "instance network", value: "10.20.30.", action: "allow" },
			{ name: "instance network", value: "::ffff:10.20.30.", action: "allow" },
			{ name: "instance network", value: "127.0.0.1", action: "allow" },
			{ name: "instance network", value: "::ffff:127.0.0.1", action: "allow" },
			{ name: "anywhere else", value: "*", action: "block" },
		])
	})

	it("matches an IPv4 client the store sees through a dual-stack socket", () => {
		expect(breakGlassRulesOf(["172.", "::ffff:192.168.", "fd00:"])).toEqual([
			{ name: "instance network", value: "172.", action: "allow" },
			{ name: "instance network", value: "::ffff:172.", action: "allow" },
			{ name: "instance network", value: "::ffff:192.168.", action: "allow" },
			{ name: "instance network", value: "fd00:", action: "allow" },
			{ name: "anywhere else", value: "*", action: "block" },
		])
	})
})
