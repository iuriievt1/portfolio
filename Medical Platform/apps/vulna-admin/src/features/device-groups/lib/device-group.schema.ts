import { DEVICE_GROUP_CODE_MAX_LENGTH, DEVICE_GROUP_NAME_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

const texts = cs.deviceGroups.form

function tooLong(max: number): string {
	return fillText(cs.errors.tooLong, { max: String(max) })
}

const deviceGroupNameSchema = z
	.string()
	.trim()
	.min(1, texts.nameMissing)
	.max(DEVICE_GROUP_NAME_MAX_LENGTH, tooLong(DEVICE_GROUP_NAME_MAX_LENGTH))

// CAP-006-R18
export const newDeviceGroupSchema = z.object({
	code: z
		.string()
		.trim()
		.min(1, texts.codeMissing)
		.max(DEVICE_GROUP_CODE_MAX_LENGTH, tooLong(DEVICE_GROUP_CODE_MAX_LENGTH)),
	name: deviceGroupNameSchema,
})

export type NewDeviceGroupValues = z.infer<typeof newDeviceGroupSchema>

export const deviceGroupDetailsSchema = z.object({ name: deviceGroupNameSchema })

export type DeviceGroupDetailsValues = z.infer<typeof deviceGroupDetailsSchema>
