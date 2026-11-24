import { ADMINISTRATOR_ALERT_KIND, type AdministratorAlertKind } from "@ansora/contracts"
import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

const QUERY_TRUE = "true"
const QUERY_FALSE = "false"

// administration.yaml listAdministratorAlerts
export const administratorAlertPageSchema = pageSchema.extend({
	kind: z
		.enum(Object.values(ADMINISTRATOR_ALERT_KIND) as [AdministratorAlertKind, ...AdministratorAlertKind[]])
		.optional(),
	is_active: z.stringbool({ truthy: [QUERY_TRUE], falsy: [QUERY_FALSE] }).optional(),
})

export type AdministratorAlertPageInput = z.infer<typeof administratorAlertPageSchema>
