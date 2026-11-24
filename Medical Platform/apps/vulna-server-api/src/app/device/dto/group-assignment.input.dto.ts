import { type AdministrationContract, DEVICE_GROUP_CODE_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"

export type GroupAssignmentInput = AdministrationContract.components["schemas"]["GroupAssignment"]

export const groupAssignmentSchema = z.strictObject({
	group_code: z.string().trim().min(1).max(DEVICE_GROUP_CODE_MAX_LENGTH),
}) satisfies z.ZodType<GroupAssignmentInput>
