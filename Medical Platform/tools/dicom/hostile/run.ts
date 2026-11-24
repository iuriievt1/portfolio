import { startHostileServer } from "./server"

const DEFAULT_PORT = 11_112
const MAX_PORT = 65_535

const port = Number(process.env.HOSTILE_PORT ?? DEFAULT_PORT)
if (!Number.isInteger(port) || port <= 0 || port > MAX_PORT) {
	throw new Error(`HOSTILE_PORT must be a TCP port, got "${process.env.HOSTILE_PORT}"`)
}
startHostileServer(port)
