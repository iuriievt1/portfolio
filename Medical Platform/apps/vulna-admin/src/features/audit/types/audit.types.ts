import type { AdministrationContract, AuditEventType, AuditOutcome, SystemJob } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type AuditRecord = Schemas["AuditRecord"]

export type AuditRecordsPage = Schemas["AuditRecordsPage"]

export type AuditChainCheck = Schemas["AuditChainCheck"]

export type AuditExport = Schemas["AuditExport"]

export type AuditExportStatus = Schemas["AuditExportStatus"]

export type AuditExportRequest = NonNullable<
	AdministrationContract.operations["exportAudit"]["requestBody"]
>["content"]["application/json"]

export interface AuditFilter {
	fromDate: string | undefined
	toDate: string | undefined
	eventType: AuditEventType | undefined
	outcome: AuditOutcome | undefined
	user: string | undefined
	device: string | undefined
	systemJob: SystemJob | undefined
	patientIdentifier: string | undefined
}
