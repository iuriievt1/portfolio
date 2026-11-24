import type { AdministeredAcquisitionState, AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type AdministeredAcquisition = Schemas["AcquisitionDetail"]

export type AdministeredAcquisitionsPage = Schemas["AcquisitionsPage"]

export type AcquisitionInstance = NonNullable<AdministeredAcquisition["instance"]>[number]

export type PatientIdentifier = AdministeredAcquisition["patient_identifiers"][number]

export interface AcquisitionFilter {
	state: AdministeredAcquisitionState | undefined
	fromDate: string | undefined
	toDate: string | undefined
	patientIdentifier: string | undefined
}
