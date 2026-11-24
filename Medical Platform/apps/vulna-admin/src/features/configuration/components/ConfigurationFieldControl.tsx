import { type ComponentProps, useId } from "react"
import { describedByOf, FieldMessages } from "@/components/custom/form-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { type ConfigurationField, FIELD_KIND } from "@/features/configuration/constants/configuration-fields"
import {
	type EditValue,
	isDurationEdit,
	isRoleRows,
	isTransferSyntaxesEdit,
	NOT_CHOSEN,
} from "@/features/configuration/lib/configuration-form"
import {
	choiceLabel,
	daysName,
	durationUnitName,
	fieldHint,
	fieldLabel,
	languageName,
	languageNames,
	megabytesName,
} from "@/features/configuration/lib/configuration-text"
import cs from "@/i18n/cs.json"
import { type DurationUnit, fillText } from "@/lib/format"
import { RoleMappingField } from "./RoleMappingField"
import { SETTING_LABEL, SETTING_ROW, SettingRow } from "./SettingRow"
import { TransferSyntaxesField } from "./TransferSyntaxesField"

const AMOUNT_INPUT = "w-28"
const WIDE_CONTROL = "max-w-sm"

const INPUT_MODE = {
	WHOLE: "numeric",
	DECIMAL: "decimal",
} as const

type InputMode = (typeof INPUT_MODE)[keyof typeof INPUT_MODE]

interface Props {
	field: ConfigurationField
	edit: EditValue
	supportedLanguages: readonly string[]
	error: string | undefined
	onChange: (edit: EditValue) => void
}

function fieldId(key: string): string {
	return `configuration-${key.replaceAll(".", "-")}`
}

// DESIGN.md 9.4
export function ConfigurationFieldControl({ field, edit, supportedLanguages, error, onChange }: Props) {
	const id = fieldId(field.key)
	const label = fieldLabel(field)
	const hint = field.kind === FIELD_KIND.LANGUAGES ? languageNames(String(edit)) : fieldHint(field)

	if (field.kind === FIELD_KIND.SWITCH) {
		return <SwitchField id={id} label={label} hint={hint} checked={edit === true} onChange={onChange} />
	}
	if (field.kind === FIELD_KIND.TRANSFER_SYNTAXES) {
		return isTransferSyntaxesEdit(edit) ? (
			<TransferSyntaxesField id={id} label={label} hint={hint} error={error} edit={edit} onChange={onChange} />
		) : null
	}
	if (field.kind === FIELD_KIND.ROLE_MAPPING) {
		return (
			<RoleMappingField
				id={id}
				label={label}
				hint={hint}
				error={error}
				rows={isRoleRows(edit) ? edit : []}
				onChange={onChange}
			/>
		)
	}

	return (
		<SettingRow id={id} label={label} hint={hint} error={error}>
			{(control) => {
				const common = {
					id: control.id,
					"aria-invalid": control.invalid,
					"aria-describedby": control.describedBy,
				}
				switch (field.kind) {
					case FIELD_KIND.CHOICE:
						return (
							<div className={WIDE_CONTROL}>
								<NativeSelect {...common} value={String(edit)} onChange={(event) => onChange(event.target.value)}>
									{field.optional ? <option value={NOT_CHOSEN}>{cs.configuration.notChosen}</option> : null}
									{field.options.map((option) => (
										<option key={option} value={option}>
											{choiceLabel(field, option)}
										</option>
									))}
								</NativeSelect>
							</div>
						)
					case FIELD_KIND.DEFAULT_LANGUAGE:
						return (
							<div className={WIDE_CONTROL}>
								<NativeSelect {...common} value={String(edit)} onChange={(event) => onChange(event.target.value)}>
									{[...new Set([...supportedLanguages, String(edit)])].map((code) => (
										<option key={code} value={code}>
											{languageName(code)}
										</option>
									))}
								</NativeSelect>
							</div>
						)
					case FIELD_KIND.DURATION:
						return isDurationEdit(edit) ? (
							<DurationInput
								common={common}
								units={field.units}
								amount={edit.amount}
								unit={edit.unit}
								unitLabel={fillText(cs.configuration.unitLabel, { field: label })}
								onChange={onChange}
							/>
						) : null
					case FIELD_KIND.COUNT:
						return <AmountInput common={common} inputMode={INPUT_MODE.WHOLE} value={String(edit)} onChange={onChange} />
					case FIELD_KIND.DAYS:
						return (
							<AmountInput
								common={common}
								inputMode={INPUT_MODE.WHOLE}
								value={String(edit)}
								suffix={daysName(String(edit))}
								onChange={onChange}
							/>
						)
					case FIELD_KIND.MEGABYTES:
						return (
							<AmountInput
								common={common}
								inputMode={INPUT_MODE.DECIMAL}
								value={String(edit)}
								suffix={megabytesName(String(edit))}
								onChange={onChange}
							/>
						)
					default:
						return (
							<Input
								{...common}
								className={WIDE_CONTROL}
								autoComplete="off"
								spellCheck={false}
								value={String(edit)}
								onChange={(event) => onChange(event.target.value)}
							/>
						)
				}
			}}
		</SettingRow>
	)
}

type CommonProps = Pick<ComponentProps<"input">, "id" | "aria-invalid" | "aria-describedby">

function SwitchField({
	id,
	label,
	hint,
	checked,
	onChange,
}: {
	id: string
	label: string
	hint: string | undefined
	checked: boolean
	onChange: (edit: EditValue) => void
}) {
	return (
		<div className={SETTING_ROW}>
			<div className={SETTING_LABEL}>
				<Label htmlFor={id}>{label}</Label>
				<FieldMessages id={id} hint={hint} />
			</div>
			<div className="flex h-8 items-center">
				<Switch
					id={id}
					checked={checked}
					aria-describedby={describedByOf(id, hint, undefined)}
					onCheckedChange={(value) => onChange(value)}
				/>
			</div>
		</div>
	)
}

function AmountInput({
	common,
	inputMode,
	value,
	suffix,
	onChange,
}: {
	common: CommonProps
	inputMode: InputMode
	value: string
	suffix?: string
	onChange: (edit: EditValue) => void
}) {
	return (
		<div className="flex items-center gap-2">
			<Input
				{...common}
				className={AMOUNT_INPUT}
				inputMode={inputMode}
				autoComplete="off"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
			{suffix === undefined ? null : <span className="text-sm text-muted-foreground">{suffix}</span>}
		</div>
	)
}

function DurationInput({
	common,
	units,
	amount,
	unit,
	unitLabel,
	onChange,
}: {
	common: CommonProps
	units: readonly DurationUnit[]
	amount: string
	unit: DurationUnit
	unitLabel: string
	onChange: (edit: EditValue) => void
}) {
	const unitId = useId()
	return (
		<div className="flex items-center gap-2">
			<Input
				{...common}
				className={AMOUNT_INPUT}
				inputMode={INPUT_MODE.DECIMAL}
				autoComplete="off"
				value={amount}
				onChange={(event) => onChange({ amount: event.target.value, unit })}
			/>
			{units.length === 1 ? (
				<span className="text-sm text-muted-foreground">{durationUnitName(unit, amount)}</span>
			) : (
				<div className="w-32">
					<NativeSelect
						id={unitId}
						aria-label={unitLabel}
						value={unit}
						onChange={(event) => {
							const next = units.find((candidate) => candidate === event.target.value)
							if (next !== undefined) {
								onChange({ amount, unit: next })
							}
						}}
					>
						{units.map((candidate) => (
							<option key={candidate} value={candidate}>
								{durationUnitName(candidate, amount)}
							</option>
						))}
					</NativeSelect>
				</div>
			)}
		</div>
	)
}
