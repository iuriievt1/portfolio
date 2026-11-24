import { DependencyObservation } from "@ansora/core-server"

// CAP-028-R22, administration.yaml OperationalMetrics.clinical_record_store
export class ClinicalRecordStoreObservation extends DependencyObservation {
	private rejectedRequestsInOutage = 0
	private rejectedRequestsSinceStart = 0

	override recordAnswer(): void {
		super.recordAnswer()
		this.rejectedRequestsInOutage = 0
	}

	// ADR-054
	recordRejectedRequest(now: number): void {
		this.recordUnavailability(now)
		this.rejectedRequestsInOutage += 1
		this.rejectedRequestsSinceStart += 1
	}

	rejectedRequestCount(): number {
		return this.rejectedRequestsInOutage
	}

	// CAP-028-R10
	rejectedRequestTotal(): number {
		return this.rejectedRequestsSinceStart
	}
}
