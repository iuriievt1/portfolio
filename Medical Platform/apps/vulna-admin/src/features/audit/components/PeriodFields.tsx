import type { UseFormRegisterReturn } from "react-hook-form"
import { FormField } from "@/components/custom/form-field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { ANY_VALUE } from "@/features/audit/lib/audit-filter"
import { EVENT_TYPE_OPTIONS } from "@/features/audit/lib/audit-text"
import cs from "@/i18n/cs.json"

interface Props {
	idPrefix: string
	from: UseFormRegisterReturn
	to: UseFormRegisterReturn
	eventType: UseFormRegisterReturn
	fromError: string | undefined
	toError: string | undefined
}

// NAB-351, CAP-025-R07
export function PeriodFields({ idPrefix, from, to, eventType, fromError, toError }: Props) {
	return (
		<>
			<FormField id={`${idPrefix}-from`} label={cs.audit.filters.from} error={fromError}>
				{(control) => (
					<Input
						id={control.id}
						type="date"
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						{...from}
					/>
				)}
			</FormField>
			<FormField id={`${idPrefix}-to`} label={cs.audit.filters.to} error={toError}>
				{(control) => (
					<Input
						id={control.id}
						type="date"
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						{...to}
					/>
				)}
			</FormField>
			<FormField id={`${idPrefix}-event-type`} label={cs.audit.fields.event}>
				{(control) => (
					<NativeSelect id={control.id} {...eventType}>
						<option value={ANY_VALUE}>{cs.audit.filters.any}</option>
						{EVENT_TYPE_OPTIONS.map((option) => (
							<option key={option.code} value={option.code}>
								{option.label}
							</option>
						))}
					</NativeSelect>
				)}
			</FormField>
		</>
	)
}
