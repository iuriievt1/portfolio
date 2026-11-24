import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { requestAuditExport } from "@/features/audit/hooks/use-audit"
import { exportRequestOf } from "@/features/audit/lib/audit-filter"
import { type AuditExportValues, auditExportSchema } from "@/features/audit/lib/audit-filter.schema"
import type { AuditFilter } from "@/features/audit/types/audit.types"
import cs from "@/i18n/cs.json"
import { download } from "@/lib/download"
import { errorMessageOf } from "@/lib/error-message"
import { PeriodFields } from "./PeriodFields"

const texts = cs.audit.export
const FIELD_ID_PREFIX = "audit-export"

interface Props {
	open: boolean
	filter: AuditFilter
	onOpenChange: (open: boolean) => void
}

// NAB-351, NAB-442, CAP-025-R07
export function AuditExportDialog({ open, filter, onOpenChange }: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent closeLabel={cs.common.close} className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{texts.heading}</DialogTitle>
					<DialogDescription>{texts.description}</DialogDescription>
				</DialogHeader>
				<ExportForm filter={filter} onDone={() => onOpenChange(false)} />
			</DialogContent>
		</Dialog>
	)
}

function ExportForm({ filter, onDone }: { filter: AuditFilter; onDone: () => void }) {
	const form = useForm<AuditExportValues>({
		resolver: zodResolver(auditExportSchema),
		defaultValues: {
			fromDate: filter.fromDate ?? "",
			toDate: filter.toDate ?? "",
			eventType: filter.eventType ?? "",
		},
	})
	const [failure, setFailure] = useState<unknown>(undefined)
	const errors = form.formState.errors

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		try {
			const created = await requestAuditExport(exportRequestOf(values))
			if (created.link === null || created.link === undefined) {
				setFailure(new Error(`export ${created.id} has no file`))
				return
			}
			download(created.link)
			onDone()
		} catch (error) {
			setFailure(error)
		}
	})

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			<PeriodFields
				idPrefix={FIELD_ID_PREFIX}
				from={form.register("fromDate")}
				to={form.register("toDate")}
				eventType={form.register("eventType")}
				fromError={errors.fromDate?.message}
				toError={errors.toDate?.message}
			/>
			{failure === undefined ? null : <Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure)}</Notice>}
			<DialogFooter>
				<DialogClose render={<Button variant="outline" />}>{cs.common.cancel}</DialogClose>
				<Button type="submit" disabled={form.formState.isSubmitting}>
					{form.formState.isSubmitting ? texts.submitting : texts.submit}
				</Button>
			</DialogFooter>
		</form>
	)
}
