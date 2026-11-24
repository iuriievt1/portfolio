import { parentPort, workerData } from "node:worker_threads"
import type { ViewingCopyJob } from "../types/clinical-record-upload.types"
import { viewingCopyOf } from "../utils/viewing-copy"

// CAP-021-R40, ADR-050 bod 13
const job = workerData as ViewingCopyJob
parentPort?.postMessage(viewingCopyOf(job.original, job.settings))
