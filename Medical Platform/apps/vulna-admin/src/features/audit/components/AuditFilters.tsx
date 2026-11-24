import { zodResolver } from "@hookform/resolvers/zod"
import { DownloadSimpleIcon, FunnelIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import { cn } from "cn"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
	ANY_VALUE,
	AUDIT_OUTCOMES,
	EMPTY_AUDIT_FILTER,
	filterOfValues,
	SYSTEM_JOBS,
	valuesOfFilter,
} from "@/features/audit/lib/audit-filter"
import { type AuditFilterValues, auditFilterSchema } from "@/features/audit/lib/audit-filter.schema"
import { outcomeText, systemJobText } from "@/features/audit/lib/audit-text"
import type { AuditFilter } from "@/features/audit/types/audit.types"
import cs from "@/i18n/cs.json"
import { REVEAL } from "@/lib/motion"
import { PeriodFields } from "./PeriodFields"

const texts = cs.audit.filters

const FIELD_ID_PREFIX = "audit-filter"
const ADVANCED_ID = `${FIELD_ID_PREFIX}-advanced`

const FIELD_ID = {
	OUTCOME: `${FIELD_ID_PREFIX}-outcome`,
	USER: `${FIELD_ID_PREFIX}-user`,
	DEVICE: `${FIELD_ID_PREFIX}-device`,
	PATIENT: `${FIELD_ID_PREFIX}-patient`,
	SYSTEM_JOB: `${FIELD_ID_PREFIX}-system-job`,
} as const

function hasAdvancedFilter(filter: AuditFilter): boolean {
	return [filter.outcome, filter.device, filter.patientIdentifier, filter.systemJob].some(
		(value) => value !== undefined,
	)
}

interface Props {
	filter: AuditFilter
	filtered: boolean
	onApply: (filter: AuditFilter) => void
	onExport: () => void
}

// CAP-025-R07, administrace-model-a-api.md 9
export function AuditFilters({ filter, filtered, onApply, onExport }: Props) {
	const form = useForm<AuditFilterValues>({
		resolver: zodResolver(auditFilterSchema),
		defaultValues: valuesOfFilter(filter),
	})
	const errors = form.formState.errors
	const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedFilter(filter))
	const submit = form.handleSubmit((values) => onApply(filterOfValues(values)))

	return (
		<search className="border-b p-(--card-p)">
			<form
				aria-label={texts.label}
				className="flex flex-col gap-4"
				onSubmit={(event) => void submit(event)}
				noValidate
			>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<PeriodFields
						idPrefix={FIELD_ID_PREFIX}
						from={form.register("fromDate")}
						to={form.register("toDate")}
						eventType={form.register("eventType")}
						fromError={errors.fromDate?.message}
						toError={errors.toDate?.message}
					/>
					<FormField id={FIELD_ID.USER} label={texts.user} error={errors.user?.message}>
						{(control) => (
							<Input
								id={control.id}
								autoComplete="off"
								aria-invalid={control.invalid}
								aria-describedby={control.describedBy}
								{...form.register("user")}
							/>
						)}
					</FormField>
				</div>
				{advancedOpen ? (
					<div id={ADVANCED_ID} className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", REVEAL)}>
						<FormField id={FIELD_ID.OUTCOME} label={cs.audit.fields.outcome}>
							{(control) => (
								<NativeSelect id={control.id} {...form.register("outcome")}>
									<option value={ANY_VALUE}>{texts.any}</option>
									{AUDIT_OUTCOMES.map((outcome) => (
										<option key={outcome} value={outcome}>
											{outcomeText(outcome)}
										</option>
									))}
								</NativeSelect>
							)}
						</FormField>
						<FormField id={FIELD_ID.DEVICE} label={texts.device} error={errors.device?.message}>
							{(control) => (
								<Input
									id={control.id}
									autoComplete="off"
									className="identifier"
									aria-invalid={control.invalid}
									aria-describedby={control.describedBy}
									{...form.register("device")}
								/>
							)}
						</FormField>
						<FormField id={FIELD_ID.PATIENT} label={texts.patient} error={errors.patientIdentifier?.message}>
							{(control) => (
								<Input
									id={control.id}
									autoComplete="off"
									className="identifier"
									aria-invalid={control.invalid}
									aria-describedby={control.describedBy}
									{...form.register("patientIdentifier")}
								/>
							)}
						</FormField>
						<FormField id={FIELD_ID.SYSTEM_JOB} label={texts.systemJob}>
							{(control) => (
								<NativeSelect id={control.id} {...form.register("systemJob")}>
									<option value={ANY_VALUE}>{texts.any}</option>
									{SYSTEM_JOBS.map((job) => (
										<option key={job} value={job}>
											{systemJobText(job)}
										</option>
									))}
								</NativeSelect>
							)}
						</FormField>
					</div>
				) : null}
				<div className="flex flex-wrap items-center gap-2">
					<Button type="submit" size="sm">
						<MagnifyingGlassIcon aria-hidden />
						{texts.apply}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-expanded={advancedOpen}
						aria-controls={ADVANCED_ID}
						onClick={() => setAdvancedOpen((open) => !open)}
					>
						<FunnelIcon aria-hidden />
						{advancedOpen ? texts.fewer : texts.more}
					</Button>
					{filtered ? (
						<Button type="button" variant="ghost" size="sm" onClick={() => onApply(EMPTY_AUDIT_FILTER)}>
							{texts.clear}
						</Button>
					) : null}
					<Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onExport}>
						<DownloadSimpleIcon aria-hidden />
						{cs.audit.export.open}
					</Button>
				</div>
			</form>
		</search>
	)
}
