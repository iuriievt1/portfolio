import { MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type { RequestRateVerdict, RequestWindow } from "../types/request-rate.types"

const SECONDS_PER_MINUTE = 60
const WINDOW_MILLISECONDS = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND

@Injectable()
export class RequestRateService {
	private readonly windows = new Map<string, RequestWindow>()

	take(deviceKey: string, limit: number, now: Date): RequestRateVerdict {
		const time = now.getTime()
		const current = this.windows.get(deviceKey)
		if (current === undefined || hasEnded(current, time)) {
			this.forgetEnded(time)
			this.windows.set(deviceKey, { startedAt: time, count: 1 })
			return { allowed: true }
		}
		if (current.count >= limit) {
			const remaining = current.startedAt + WINDOW_MILLISECONDS - time
			return { allowed: false, retryAfterSeconds: Math.ceil(remaining / MILLISECONDS_PER_SECOND) }
		}
		current.count += 1
		return { allowed: true }
	}

	private forgetEnded(time: number): void {
		for (const [key, window] of this.windows) {
			if (hasEnded(window, time)) {
				this.windows.delete(key)
			}
		}
	}
}

function hasEnded(window: RequestWindow, time: number): boolean {
	return time - window.startedAt >= WINDOW_MILLISECONDS
}
