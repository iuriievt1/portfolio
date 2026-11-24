import { TEXT_RECOGNITION_RESTART_REASON_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

// CAP-022-R15, administration.yaml TextRecognitionRestart
export const textRecognitionRestartSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(1, cs.deliveries.restartDialog.reasonMissing)
		.max(
			TEXT_RECOGNITION_RESTART_REASON_MAX_LENGTH,
			fillText(cs.errors.tooLong, { max: String(TEXT_RECOGNITION_RESTART_REASON_MAX_LENGTH) }),
		),
})

export type TextRecognitionRestartValues = z.infer<typeof textRecognitionRestartSchema>
