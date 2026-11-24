import { CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import { DocumentationUnavailableException } from "../exceptions/documentation-unavailable.exception"
import { storesWith } from "./clinical-record-fixtures"

function unavailable(): ClinicalRecordStoreError {
	return new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "connect ECONNREFUSED")
}

function rejected(): ClinicalRecordStoreError {
	return new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "422 Unprocessable Entity")
}

describe("ClinicalRecordStoreService", () => {
	it("CAP-028-S09 counts a write rejected because the store is not configured", async () => {
		const dependencies = new DependencyStateService()
		const stores = storesWith(undefined, dependencies)

		await expect(stores.requireStore("visit 1")).rejects.toBeInstanceOf(DocumentationUnavailableException)
		expect(dependencies.clinicalRecordStore.rejectedRequestCount()).toBe(1)
	})

	it("CAP-028-S09 counts a write rejected because the store is unavailable", async () => {
		const dependencies = new DependencyStateService()
		const stores = storesWith({}, dependencies)

		await expect(stores.written("visit 1", async () => Promise.reject(unavailable()))).rejects.toBeInstanceOf(
			DocumentationUnavailableException,
		)
		expect(dependencies.clinicalRecordStore.rejectedRequestCount()).toBe(1)
	})

	it("does not count a write the store refused as data", async () => {
		const dependencies = new DependencyStateService()
		const stores = storesWith({}, dependencies)

		await expect(stores.written("visit 1", async () => Promise.reject(rejected()))).rejects.toBeInstanceOf(
			DocumentationUnavailableException,
		)
		expect(dependencies.clinicalRecordStore.rejectedRequestCount()).toBe(0)
	})
})
