import { isClinicalRecordUnavailability } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import { READ_CIRCUIT_FAILURE_THRESHOLD, READ_CIRCUIT_OPEN_MILLISECONDS } from "../constants/read-circuit.constants"

// backend.md 3.1, ADR-050 bod 11, CAP-020-R16, CAP-020-S10
@Injectable()
export class ReadCircuitService {
	private readonly logger = new Logger(ReadCircuitService.name)
	private consecutiveFailures = 0
	private openedAt: number | undefined
	private isTrialRunning = false

	allows(now: number): boolean {
		if (this.openedAt === undefined) {
			return true
		}
		if (this.isTrialRunning || now - this.openedAt < READ_CIRCUIT_OPEN_MILLISECONDS) {
			return false
		}
		this.isTrialRunning = true
		return true
	}

	recordAnswer(): void {
		if (this.openedAt !== undefined) {
			this.logger.log("Reads from the clinical record store are closed again: the store answers")
		}
		this.consecutiveFailures = 0
		this.openedAt = undefined
		this.isTrialRunning = false
	}

	recordFailure(error: unknown, now: number): void {
		if (!isClinicalRecordUnavailability(error)) {
			this.recordAnswer()
			return
		}
		this.consecutiveFailures += 1
		this.isTrialRunning = false
		if (this.consecutiveFailures < READ_CIRCUIT_FAILURE_THRESHOLD) {
			return
		}
		if (this.openedAt === undefined) {
			this.logger.warn(
				`Reads from the clinical record store are open for ${READ_CIRCUIT_OPEN_MILLISECONDS} ms after ${this.consecutiveFailures} failures`,
			)
		}
		this.openedAt = now
	}
}
