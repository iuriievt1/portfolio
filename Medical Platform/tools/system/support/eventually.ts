import { setTimeout as delay } from "node:timers/promises"

// ADR-024
const POLL_MILLISECONDS = 500

export async function eventually<T>(
	description: string,
	read: () => Promise<T>,
	isDone: (value: T) => boolean,
	timeoutMilliseconds: number,
): Promise<T> {
	const deadline = Date.now() + timeoutMilliseconds
	let last = await read()
	while (!isDone(last)) {
		if (Date.now() >= deadline) {
			throw new Error(`${description} did not happen: ${JSON.stringify(last)}`)
		}
		await delay(POLL_MILLISECONDS)
		last = await read()
	}
	return last
}
