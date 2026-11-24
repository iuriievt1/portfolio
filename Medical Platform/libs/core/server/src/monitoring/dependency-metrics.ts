import { DEPENDENCY_STATE, type DependencyState } from "@ansora/contracts"
import { METRIC_TYPE, type MetricFamily } from "./openmetrics"

const DEPENDENCY_FAMILY = "vulna_dependency"
const DEPENDENCY_LABEL = "dependency"
const PRESENT = 1
const ABSENT = 0

// CAP-028-R05, CAP-028-R07, CAP-028-R20
export function dependencyStateFamily(states: Readonly<Record<string, DependencyState>>): MetricFamily {
	return {
		name: DEPENDENCY_FAMILY,
		type: METRIC_TYPE.STATESET,
		help: "State of a dependency as the process last saw it",
		unit: undefined,
		samples: Object.entries(states).flatMap(([dependency, current]) =>
			Object.values(DEPENDENCY_STATE).map((state) => ({
				labels: { [DEPENDENCY_LABEL]: dependency, [DEPENDENCY_FAMILY]: state },
				value: state === current ? PRESENT : ABSENT,
			})),
		),
	}
}
