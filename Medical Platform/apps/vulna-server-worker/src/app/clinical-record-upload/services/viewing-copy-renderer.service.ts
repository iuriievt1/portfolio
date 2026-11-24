import { extname, join } from "node:path"
import { Worker } from "node:worker_threads"
import { Injectable } from "@nestjs/common"
import type { ViewingCopyJob } from "../types/clinical-record-upload.types"
import { loaderArgumentsOf } from "../utils/loader-arguments"
import type { ViewingCopySettings } from "../utils/viewing-copy"

const THREAD_FILE = join(__dirname, "..", "threads", `viewing-copy.thread${extname(__filename)}`)
const SUCCESSFUL_EXIT = 0

// CAP-021-R40, ADR-050 bod 13, ADR-005 ř. 38
@Injectable()
export class ViewingCopyRendererService {
	async copyOf(original: Uint8Array, settings: ViewingCopySettings): Promise<Buffer> {
		const job: ViewingCopyJob = { original, settings }
		const thread = new Worker(THREAD_FILE, { workerData: job, execArgv: loaderArgumentsOf(process.execArgv) })
		return await new Promise<Buffer>((resolve, reject) => {
			let copy: Buffer | undefined
			thread.on("message", (message: unknown) => {
				if (message instanceof Uint8Array) {
					copy = Buffer.from(message.buffer, message.byteOffset, message.byteLength)
				}
			})
			thread.once("error", reject)
			thread.once("exit", (code) => {
				if (copy !== undefined) {
					resolve(copy)
					return
				}
				if (code !== SUCCESSFUL_EXIT) {
					reject(new Error(`the viewing copy thread exited with code ${code}`))
					return
				}
				reject(new Error("the viewing copy thread exited without a copy"))
			})
		})
	}
}
