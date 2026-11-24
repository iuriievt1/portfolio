import { DEPENDENCY_STATE, type DependencyState } from "@ansora/contracts"
import { MILLISECONDS_PER_SECOND } from "../login/secret"

// CAP-028-R05, CAP-028-R20, administration.yaml OperationalMetrics.dependencies
export class DependencyObservation {
	private lastState: DependencyState = DEPENDENCY_STATE.UNKNOWN
	private unavailableSinceMilliseconds: number | undefined
	private lastUnavailableMilliseconds: number | undefined

	state(): DependencyState {
		return this.lastState
	}

	recordAnswer(): void {
		this.lastState = DEPENDENCY_STATE.AVAILABLE
		this.unavailableSinceMilliseconds = undefined
		this.lastUnavailableMilliseconds = undefined
	}

	recordUnavailability(now: number): void {
		this.lastState = DEPENDENCY_STATE.UNAVAILABLE
		this.unavailableSinceMilliseconds ??= now
		this.lastUnavailableMilliseconds = now
	}

	unavailableSince(): number | undefined {
		return this.unavailableSinceMilliseconds
	}

	outageSeconds(): number | undefined {
		const since = this.unavailableSinceMilliseconds
		const last = this.lastUnavailableMilliseconds
		if (since === undefined || last === undefined) {
			return undefined
		}
		return Math.floor((last - since) / MILLISECONDS_PER_SECOND)
	}
}
