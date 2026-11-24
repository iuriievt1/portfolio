import { describe, expect, it } from "vitest"
import { textRecognitionRestartSchema } from "@/features/deliveries/lib/text-recognition-restart.schema"
import cs from "@/i18n/cs.json"

describe("restarting the text recognition ✓ CAP-022-R15, administration.yaml TextRecognitionRestart", () => {
	it("CAP-022-R15 refuses a restart without a reason", () => {
		const result = textRecognitionRestartSchema.safeParse({ reason: "   " })

		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.message).toBe(cs.deliveries.restartDialog.reasonMissing)
	})

	it("CAP-022-S06 sends the reason without the spaces around it", () => {
		expect(textRecognitionRestartSchema.parse({ reason: " Opravena paměť nástroje OCR " })).toEqual({
			reason: "Opravena paměť nástroje OCR",
		})
	})
})
