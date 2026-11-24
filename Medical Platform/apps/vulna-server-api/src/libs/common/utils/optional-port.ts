const LOWEST_PORT = 1
const HIGHEST_PORT = 65_535

export function optionalPortOf(value: string | undefined): number | undefined {
	if (value === undefined) {
		return undefined
	}
	const port = Number(value)
	if (!Number.isInteger(port) || port < LOWEST_PORT || port > HIGHEST_PORT) {
		throw new Error(`The port ${value} is not a valid TCP port`)
	}
	return port
}
