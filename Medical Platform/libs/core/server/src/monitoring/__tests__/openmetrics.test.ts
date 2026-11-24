import { describe, expect, it } from "vitest"
import { dependencyStateFamily } from "../dependency-metrics"
import { METRIC_TYPE, openMetricsText } from "../openmetrics"

describe("openMetricsText", () => {
	it("CAP-028-R10 writes gauges, counters and state sets and ends the exposition", () => {
		const text = openMetricsText([
			{
				name: "vulna_upload_lag_seconds",
				type: METRIC_TYPE.GAUGE,
				help: "Age of the oldest upload",
				unit: "seconds",
				samples: [{ labels: {}, value: 900 }],
			},
			{
				name: "vulna_rejected_requests",
				type: METRIC_TYPE.COUNTER,
				help: "Rejected requests",
				unit: undefined,
				samples: [{ labels: {}, value: 3 }],
			},
			{
				name: "vulna_dependency",
				type: METRIC_TYPE.STATESET,
				help: "State of a dependency",
				unit: undefined,
				samples: [
					{ labels: { dependency: "database", vulna_dependency: "available" }, value: 1 },
					{ labels: { dependency: "database", vulna_dependency: "unavailable" }, value: 0 },
				],
			},
		])

		expect(text).toBe(
			[
				"# TYPE vulna_upload_lag_seconds gauge",
				"# UNIT vulna_upload_lag_seconds seconds",
				"# HELP vulna_upload_lag_seconds Age of the oldest upload",
				"vulna_upload_lag_seconds 900",
				"# TYPE vulna_rejected_requests counter",
				"# HELP vulna_rejected_requests Rejected requests",
				"vulna_rejected_requests_total 3",
				"# TYPE vulna_dependency stateset",
				"# HELP vulna_dependency State of a dependency",
				'vulna_dependency{dependency="database",vulna_dependency="available"} 1',
				'vulna_dependency{dependency="database",vulna_dependency="unavailable"} 0',
				"# EOF",
				"",
			].join("\n"),
		)
	})

	it("escapes label values and help text", () => {
		const text = openMetricsText([
			{
				name: "vulna_example",
				type: METRIC_TYPE.GAUGE,
				help: 'line\\one\nline "two"',
				unit: undefined,
				samples: [{ labels: { reason: 'a "quoted"\\ value\n' }, value: 1 }],
			},
		])

		expect(text).toContain('# HELP vulna_example line\\\\one\\nline \\"two\\"')
		expect(text).toContain('vulna_example{reason="a \\"quoted\\"\\\\ value\\n"} 1')
	})

	it("writes values that are not finite the way OpenMetrics names them", () => {
		const text = openMetricsText([
			{
				name: "vulna_example",
				type: METRIC_TYPE.GAUGE,
				help: "example",
				unit: undefined,
				samples: [
					{ labels: { bound: "upper" }, value: Number.POSITIVE_INFINITY },
					{ labels: { bound: "lower" }, value: Number.NEGATIVE_INFINITY },
					{ labels: { bound: "none" }, value: Number.NaN },
				],
			},
		])

		expect(text).toContain('vulna_example{bound="upper"} +Inf')
		expect(text).toContain('vulna_example{bound="lower"} -Inf')
		expect(text).toContain('vulna_example{bound="none"} NaN')
	})

	it("refuses a name OpenMetrics does not allow and a unit missing from the name", () => {
		const family = { type: METRIC_TYPE.GAUGE, help: "x", samples: [] }

		expect(() => openMetricsText([{ ...family, name: "vulna-bad", unit: undefined }])).toThrow()
		expect(() => openMetricsText([{ ...family, name: "vulna_size", unit: "bytes" }])).toThrow()
	})
})

describe("dependencyStateFamily", () => {
	it("CAP-028-R07 writes one state set sample for every state of every dependency", () => {
		const text = openMetricsText([dependencyStateFamily({ database: "available", pacs: "unknown" })])

		expect(text).toContain('vulna_dependency{dependency="database",vulna_dependency="available"} 1')
		expect(text).toContain('vulna_dependency{dependency="database",vulna_dependency="unavailable"} 0')
		expect(text).toContain('vulna_dependency{dependency="pacs",vulna_dependency="unknown"} 1')
		expect(text.split("\n").filter((line) => line.startsWith("vulna_dependency{"))).toHaveLength(6)
	})
})
