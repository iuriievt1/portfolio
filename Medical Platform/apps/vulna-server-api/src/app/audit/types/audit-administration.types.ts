import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type AuditRecordView = Schemas["AuditRecord"]

export type AuditRecordsPage = Schemas["AuditRecordsPage"]

export type AuditChainCheckView = Schemas["AuditChainCheck"]

export type AuditExportView = Schemas["AuditExport"]

export type AuditExportStatusView = Schemas["AuditExportStatus"]

export interface AuditExportFile {
	fileName: string
	lines: AsyncIterable<string>
}
