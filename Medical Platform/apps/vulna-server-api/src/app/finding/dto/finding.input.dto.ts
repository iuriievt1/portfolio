import { CODE_LIST_ITEM_CODE_MAX_LENGTH, CODE_LIST_SET_VERSION_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

const codeListItemCode = z.string().trim().min(1).max(CODE_LIST_ITEM_CODE_MAX_LENGTH)
const codeListVersion = z.string().trim().min(1).max(CODE_LIST_SET_VERSION_MAX_LENGTH)

// clinical-workflow.yaml listPatientFindings
export const patientFindingsSchema = pageSchema.extend({
	patient_id: z.uuid(),
})

export type PatientFindingsInput = z.infer<typeof patientFindingsSchema>

// index.yaml FindingId
export const findingIdSchema = z.uuid()

// clinical-workflow.yaml FindingWoundTypeChange, CAP-020-R21
export const findingWoundTypeChangeSchema = z.strictObject({
	wound_type_code: codeListItemCode,
	code_list_version: codeListVersion,
	previous_wound_type_code: codeListItemCode,
})

export type FindingWoundTypeChangeInput = z.infer<typeof findingWoundTypeChangeSchema>
