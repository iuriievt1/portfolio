import { type AdministrationContract, TEXT_RECOGNITION_RESTART_REASON_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"

type TextRecognitionRestart = AdministrationContract.components["schemas"]["TextRecognitionRestart"]

// administration.yaml TextRecognitionRestart, CAP-022-R15
export const textRecognitionRestartSchema = z.strictObject({
	reason: z.string().trim().min(1).max(TEXT_RECOGNITION_RESTART_REASON_MAX_LENGTH),
}) satisfies z.ZodType<TextRecognitionRestart>

export type TextRecognitionRestartInput = z.infer<typeof textRecognitionRestartSchema>
