import { XIcon } from "@phosphor-icons/react"
import { DetailFields } from "@/components/custom/detail-fields"
import { Button } from "@/components/ui/button"
import { SHEET_SIDE, Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { eventText } from "@/features/audit/lib/audit-text"
import type { AuditRecord } from "@/features/audit/types/audit.types"
import cs from "@/i18n/cs.json"
import { chainOf, eventDetailsOf, summaryOf } from "./AuditRecordFields"

interface Props {
	record: AuditRecord | undefined
	open: boolean
	onOpenChange: (open: boolean) => void
}

// CAP-025-R04, DESIGN.md 9.5
export function AuditRecordSheet({ record, open, onOpenChange }: Props) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side={SHEET_SIDE.RIGHT} className="w-full sm:max-w-md">
				{record === undefined ? null : <RecordDetail record={record} />}
			</SheetContent>
		</Sheet>
	)
}

function RecordDetail({ record }: { record: AuditRecord }) {
	return (
		<>
			<div className="flex h-(--topbar-height) shrink-0 items-center justify-between gap-2 border-b px-(--card-p)">
				<SheetTitle>{eventText(record)}</SheetTitle>
				<SheetClose render={<Button variant="ghost" size="icon-sm" />}>
					<XIcon aria-hidden />
					<span className="sr-only">{cs.common.close}</span>
				</SheetClose>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-(--card-p)">
				<DetailFields fields={summaryOf(record)} />
				<DetailFields fields={eventDetailsOf(record)} />
				<DetailFields fields={chainOf(record)} />
			</div>
		</>
	)
}
