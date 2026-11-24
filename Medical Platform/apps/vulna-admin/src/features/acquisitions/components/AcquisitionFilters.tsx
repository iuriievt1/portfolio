import { ADMINISTERED_ACQUISITION_STATES } from "@ansora/contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { useForm } from "react-hook-form"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
	ANY_STATE,
	EMPTY_ACQUISITION_FILTER,
	filterOfValues,
	valuesOfFilter,
} from "@/features/acquisitions/lib/acquisition-filter"
import {
	type AcquisitionFilterValues,
	acquisitionFilterSchema,
} from "@/features/acquisitions/lib/acquisition-filter.schema"
import { stateText } from "@/features/acquisitions/lib/acquisition-text"
import type { AcquisitionFilter } from "@/features/acquisitions/types/acquisition.types"
import cs from "@/i18n/cs.json"

const texts = cs.acquisitions.filters

const FIELD_ID = {
	PATIENT: "acquisition-filter-patient",
	STATE: "acquisition-filter-state",
	FROM: "acquisition-filter-from",
	TO: "acquisition-filter-to",
} as const

interface Props {
	filter: AcquisitionFilter
	filtered: boolean
	onApply: (filter: AcquisitionFilter) => void
}

// CAP-004-R10, administration.yaml searchAcquisitions
export function AcquisitionFilters({ filter, filtered, onApply }: Props) {
	const form = useForm<AcquisitionFilterValues>({
		resolver: zodResolver(acquisitionFilterSchema),
		defaultValues: valuesOfFilter(filter),
	})
	const errors = form.formState.errors
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
					<FormField id={FIELD_ID.STATE} label={texts.state}>
						{(control) => (
							<NativeSelect id={control.id} {...form.register("state")}>
								<option value={ANY_STATE}>{texts.any}</option>
								{ADMINISTERED_ACQUISITION_STATES.map((state) => (
									<option key={state} value={state}>
										{stateText(state)}
									</option>
								))}
							</NativeSelect>
						)}
					</FormField>
					<FormField id={FIELD_ID.FROM} label={texts.from} error={errors.fromDate?.message}>
						{(control) => (
							<Input
								id={control.id}
								type="date"
								aria-invalid={control.invalid}
								aria-describedby={control.describedBy}
								{...form.register("fromDate")}
							/>
						)}
					</FormField>
					<FormField id={FIELD_ID.TO} label={texts.to} error={errors.toDate?.message}>
						{(control) => (
							<Input
								id={control.id}
								type="date"
								aria-invalid={control.invalid}
								aria-describedby={control.describedBy}
								{...form.register("toDate")}
							/>
						)}
					</FormField>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button type="submit" size="sm">
						<MagnifyingGlassIcon aria-hidden />
						{texts.apply}
					</Button>
					{filtered ? (
						<Button type="button" variant="ghost" size="sm" onClick={() => onApply(EMPTY_ACQUISITION_FILTER)}>
							{texts.clear}
						</Button>
					) : null}
				</div>
			</form>
		</search>
	)
}
