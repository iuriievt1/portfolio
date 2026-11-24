import { DEPARTMENT_CODE_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

// CAP-003-R07
export const userDepartmentSchema = z.object({
	department: z
		.string()
		.trim()
		.min(1, cs.user.department.missing)
		.max(DEPARTMENT_CODE_MAX_LENGTH, fillText(cs.errors.tooLong, { max: String(DEPARTMENT_CODE_MAX_LENGTH) })),
})

export type UserDepartmentValues = z.infer<typeof userDepartmentSchema>
