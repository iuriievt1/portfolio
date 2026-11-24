import { DependencyObservation } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"

// CAP-028-R20
@Injectable()
export class DependencyStateService {
	readonly clinicalRecordStore = new DependencyObservation()
}
