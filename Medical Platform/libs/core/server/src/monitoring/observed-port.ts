import type { DependencyObservation } from "./dependency-observation"

export interface DependencyFailureChecks {
	isUnavailability(error: unknown): boolean
	isAnswer(error: unknown): boolean
}

type PortMethod = (...args: unknown[]) => Promise<unknown>

function observeFailure(observation: DependencyObservation, checks: DependencyFailureChecks, error: unknown): void {
	if (checks.isUnavailability(error)) {
		observation.recordUnavailability(Date.now())
		return
	}
	if (checks.isAnswer(error)) {
		observation.recordAnswer()
	}
}

// CAP-028-R20, CAP-028-R22
export function observedPort<Port extends object>(
	port: Port,
	observation: DependencyObservation,
	checks: DependencyFailureChecks,
): Port {
	return new Proxy(port, {
		get(target, property) {
			const member: unknown = Reflect.get(target, property)
			if (typeof member !== "function" || Object.hasOwn(Object.prototype, property)) {
				return member
			}
			const method = member as PortMethod
			return async (...args: unknown[]) => {
				try {
					const answer = await method.apply(target, args)
					observation.recordAnswer()
					return answer
				} catch (error) {
					observeFailure(observation, checks, error)
					throw error
				}
			}
		},
	})
}
