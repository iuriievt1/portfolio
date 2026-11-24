import type { MobileContract } from "@ansora/contracts"
import { callApi } from "./client"
import { withQuery } from "./query"

type Schemas = MobileContract.components["schemas"]

export type QueueStateReport = Schemas["QueueStateReport"]
export type QueueStatesPage = Schemas["QueueStatesPage"]

const QUEUE_STATE_PATH: keyof MobileContract.paths = "/queue/state"
const QUEUE_REPORTS_PATH: keyof MobileContract.paths = "/queue/reports"

export const queueApi = {
	// CAP-019-R30, CAP-019-R24
	getQueueState: (accessToken: string, limit: number, cursor: string | undefined): Promise<QueueStatesPage> =>
		callApi<QueueStatesPage>(withQuery(QUEUE_STATE_PATH, { limit, cursor }), { sessionToken: accessToken }),
	// CAP-019-R08
	reportQueueState: (accessToken: string, report: QueueStateReport): Promise<void> =>
		callApi<void>(QUEUE_REPORTS_PATH, { method: "POST", body: report, sessionToken: accessToken }),
}
