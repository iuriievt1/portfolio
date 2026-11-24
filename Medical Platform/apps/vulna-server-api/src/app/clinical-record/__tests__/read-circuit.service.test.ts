import { CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { READ_CIRCUIT_FAILURE_THRESHOLD, READ_CIRCUIT_OPEN_MILLISECONDS } from "../constants/read-circuit.constants"
import { ReadCircuitService } from "../services/read-circuit.service"

const START = 1_000_000
const UNAVAILABLE = new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "the store did not answer")
const UNKNOWN = new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNKNOWN, "the answer timed out")
const REJECTED = new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "the store refused the reader")

function openedCircuit(): ReadCircuitService {
	const circuit = new ReadCircuitService()
	for (let failure = 0; failure < READ_CIRCUIT_FAILURE_THRESHOLD; failure += 1) {
		circuit.recordFailure(UNAVAILABLE, START)
	}
	return circuit
}

// backend.md 3.1, ADR-050 bod 11
describe("circuit breaker of the reads from the clinical record store CAP-020-S10", () => {
	it("lets every read through while the store answers", () => {
		const circuit = new ReadCircuitService()
		circuit.recordAnswer()

		expect(circuit.allows(START)).toBe(true)
	})

	it("opens after consecutive unavailable or unknown answers and refuses reads at once", () => {
		const circuit = new ReadCircuitService()
		for (let failure = 1; failure < READ_CIRCUIT_FAILURE_THRESHOLD; failure += 1) {
			circuit.recordFailure(failure % 2 === 0 ? UNKNOWN : UNAVAILABLE, START)
		}
		expect(circuit.allows(START)).toBe(true)

		circuit.recordFailure(UNAVAILABLE, START)

		expect(circuit.allows(START + 1)).toBe(false)
	})

	it("does not count a request the store answered by refusing it", () => {
		const circuit = new ReadCircuitService()
		for (let failure = 1; failure < READ_CIRCUIT_FAILURE_THRESHOLD; failure += 1) {
			circuit.recordFailure(UNAVAILABLE, START)
		}

		circuit.recordFailure(REJECTED, START)
		circuit.recordFailure(UNAVAILABLE, START)

		expect(circuit.allows(START)).toBe(true)
	})

	it("lets one trial read through after the open period and refuses the others meanwhile", () => {
		const circuit = openedCircuit()
		const later = START + READ_CIRCUIT_OPEN_MILLISECONDS

		expect(circuit.allows(later - 1)).toBe(false)
		expect(circuit.allows(later)).toBe(true)
		expect(circuit.allows(later)).toBe(false)
	})

	it("closes when the trial read gets an answer", () => {
		const circuit = openedCircuit()
		circuit.allows(START + READ_CIRCUIT_OPEN_MILLISECONDS)

		circuit.recordAnswer()

		expect(circuit.allows(START + READ_CIRCUIT_OPEN_MILLISECONDS)).toBe(true)
		expect(circuit.allows(START + READ_CIRCUIT_OPEN_MILLISECONDS)).toBe(true)
	})

	it("opens again for a whole period when the trial read fails", () => {
		const circuit = openedCircuit()
		const trial = START + READ_CIRCUIT_OPEN_MILLISECONDS
		circuit.allows(trial)

		circuit.recordFailure(UNAVAILABLE, trial)

		expect(circuit.allows(trial + READ_CIRCUIT_OPEN_MILLISECONDS - 1)).toBe(false)
		expect(circuit.allows(trial + READ_CIRCUIT_OPEN_MILLISECONDS)).toBe(true)
	})
})
