import { type AdministrationContract, DEVICE_FINGERPRINT_PATTERN } from "@ansora/contracts"
import { z } from "zod"

export type DeviceApprovalInput = AdministrationContract.components["schemas"]["DeviceApproval"]

export const deviceApprovalSchema = z.strictObject({
	fingerprint: z.string().regex(DEVICE_FINGERPRINT_PATTERN),
	requester_user_id: z.uuid(),
}) satisfies z.ZodType<DeviceApprovalInput>
