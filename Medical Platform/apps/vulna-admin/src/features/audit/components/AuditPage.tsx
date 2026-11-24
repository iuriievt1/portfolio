import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { Card } from "@/components/ui/card"
import { auditFilterOf, EMPTY_AUDIT_FILTER, isFiltered, searchParamsOf } from "@/features/audit/lib/audit-filter"
import type { AuditFilter, AuditRecord } from "@/features/audit/types/audit.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { AuditExportDialog } from "./AuditExportDialog"
import { AuditFilters } from "./AuditFilters"
import { AuditRecordSheet } from "./AuditRecordSheet"
import { AuditRecordsList } from "./AuditRecordsList"
import { ChainSection } from "./ChainSection"
import { SyslogExportSection } from "./SyslogExportSection"

// CAP-025-R07, CAP-025-R08, CAP-025-R21
export function AuditPage() {
	useShellTitle(cs.audit.heading)
	return (
		<div className="flex flex-col gap-(--section-gap)">
			<Card className="gap-0 divide-y py-0">
				<SyslogExportSection />
				<ChainSection />
			</Card>
			<AuditTrail />
		</div>
	)
}

function AuditTrail() {
	const [searchParams, setSearchParams] = useSearchParams()
	// DESIGN.md 9.1
	const [patientIdentifier, setPatientIdentifier] = useState<string | undefined>(undefined)
	const filter = useMemo(() => auditFilterOf(searchParams, patientIdentifier), [searchParams, patientIdentifier])
	const filtered = isFiltered(filter)
	const [selected, setSelected] = useState<AuditRecord | undefined>(undefined)
	const [detailOpen, setDetailOpen] = useState(false)
	const [exportOpen, setExportOpen] = useState(false)

	const applyFilter = useCallback(
		(next: AuditFilter) => {
			setPatientIdentifier(next.patientIdentifier)
			setSearchParams(searchParamsOf(next), { replace: true })
		},
		[setSearchParams],
	)
	const clearFilter = useCallback(() => applyFilter(EMPTY_AUDIT_FILTER), [applyFilter])
	const openRecord = useCallback((record: AuditRecord) => {
		setSelected(record)
		setDetailOpen(true)
	}, [])

	return (
		<Card className="gap-0 py-0">
			<AuditFilters
				key={JSON.stringify(filter)}
				filter={filter}
				filtered={filtered}
				onApply={applyFilter}
				onExport={() => setExportOpen(true)}
			/>
			<AuditRecordsList filter={filter} filtered={filtered} onClearFilter={clearFilter} onOpen={openRecord} />
			<AuditRecordSheet record={selected} open={detailOpen} onOpenChange={setDetailOpen} />
			<AuditExportDialog open={exportOpen} filter={filter} onOpenChange={setExportOpen} />
		</Card>
	)
}
