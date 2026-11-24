import { DependencyObservation } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { ClinicalRecordStoreObservation } from "./clinical-record-store-observation"

// CAP-028-R20
@Injectable()
export class DependencyStateService {
	readonly identityProvider = new DependencyObservation()
	readonly clinicalRecordStore = new ClinicalRecordStoreObservation()
}
