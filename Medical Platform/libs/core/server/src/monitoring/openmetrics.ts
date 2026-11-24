// CAP-028-R10, OpenMetrics 1.0
export const OPENMETRICS_CONTENT_TYPE = "application/openmetrics-text; version=1.0.0; charset=utf-8"

export const METRIC_TYPE = {
	GAUGE: "gauge",
	COUNTER: "counter",
	STATESET: "stateset",
} as const

export type MetricType = (typeof METRIC_TYPE)[keyof typeof METRIC_TYPE]

export interface MetricSample {
	labels: Readonly<Record<string, string>>
	value: number
}

export interface MetricFamily {
	name: string
	type: MetricType
	help: string
	unit: string | undefined
	samples: readonly MetricSample[]
}

const COUNTER_SUFFIX = "_total"
const END_OF_EXPOSITION = "# EOF"
const METRIC_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/
const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const POSITIVE_INFINITY = "+Inf"
const NEGATIVE_INFINITY = "-Inf"
const NOT_A_NUMBER = "NaN"

function escaped(text: string): string {
	return text.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n")
}

function valueText(value: number): string {
	if (value === Number.POSITIVE_INFINITY) {
		return POSITIVE_INFINITY
	}
	if (value === Number.NEGATIVE_INFINITY) {
		return NEGATIVE_INFINITY
	}
	return Number.isNaN(value) ? NOT_A_NUMBER : String(value)
}

function labelsText(labels: Readonly<Record<string, string>>): string {
	const pairs = Object.entries(labels).map(([name, value]) => {
		if (!LABEL_NAME.test(name)) {
			throw new Error(`the label name ${name} is not valid in OpenMetrics`)
		}
		return `${name}="${escaped(value)}"`
	})
	return pairs.length === 0 ? "" : `{${pairs.join(",")}}`
}

function sampleName(family: MetricFamily): string {
	return family.type === METRIC_TYPE.COUNTER ? `${family.name}${COUNTER_SUFFIX}` : family.name
}

function familyLines(family: MetricFamily): string[] {
	if (!METRIC_NAME.test(family.name)) {
		throw new Error(`the metric name ${family.name} is not valid in OpenMetrics`)
	}
	if (family.unit !== undefined && !family.name.endsWith(`_${family.unit}`)) {
		throw new Error(`the metric name ${family.name} does not end with its unit ${family.unit}`)
	}
	const header = [`# TYPE ${family.name} ${family.type}`]
	if (family.unit !== undefined) {
		header.push(`# UNIT ${family.name} ${family.unit}`)
	}
	header.push(`# HELP ${family.name} ${escaped(family.help)}`)
	const name = sampleName(family)
	return [
		...header,
		...family.samples.map((sample) => `${name}${labelsText(sample.labels)} ${valueText(sample.value)}`),
	]
}

// CAP-028-R09, CAP-028-R10, CAP-028-S01
export function openMetricsText(families: readonly MetricFamily[]): string {
	return `${[...families.flatMap(familyLines), END_OF_EXPOSITION].join("\n")}\n`
}
