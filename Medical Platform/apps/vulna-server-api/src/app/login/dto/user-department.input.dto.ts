import { DEPARTMENT_CODE_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import type { UserDepartmentInput } from "../types/department.types"

export const userDepartmentSchema = z.strictObject({
	department: z.string().trim().min(1).max(DEPARTMENT_CODE_MAX_LENGTH),
}) satisfies z.ZodType<UserDepartmentInput>
