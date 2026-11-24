import cs from "@/i18n/cs.json"
import { fillText, formatTime } from "./format"

export function savedAtText(savedAt: string | undefined): string | undefined {
	return savedAt === undefined ? undefined : fillText(cs.common.savedAt, { time: formatTime(savedAt) })
}
