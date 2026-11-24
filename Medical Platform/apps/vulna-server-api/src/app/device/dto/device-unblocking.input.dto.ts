import { type AdministrationContract, DEVICE_UNBLOCK_REASON_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"

export type DeviceUnblockingInput =
	AdministrationContract.operations["unblockDevice"]["requestBody"]["content"]["application/json"]

// CAP-007-R06, CAP-007-S07, administration.yaml unblockDevice
export const deviceUnblockingSchema = z.strictObject({
	reason: z.string().trim().min(1).max(DEVICE_UNBLOCK_REASON_MAX_LENGTH),
}) satisfies z.ZodType<DeviceUnblockingInput>
