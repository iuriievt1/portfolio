import type { ReactNode } from "react"
import { describedByOf, type FieldControl, FieldMessages } from "@/components/custom/form-field"
import { Label } from "@/components/ui/label"

export const SETTING_ROW = "grid gap-x-6 gap-y-1.5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
export const SETTING_LABEL = "flex flex-col gap-1 md:pt-1.5"

interface Props {
	id: string
	label: string
	hint: string | undefined
	error: string | undefined
	children: (control: FieldControl) => ReactNode
}

// DESIGN.md 9.4
export function SettingRow({ id, label, hint, error, children }: Props) {
	return (
		<div className={SETTING_ROW}>
			<div className={SETTING_LABEL}>
				<Label htmlFor={id}>{label}</Label>
				<FieldMessages id={id} hint={hint} />
			</div>
			<div className="flex min-w-0 flex-col gap-1">
				{children({ id, describedBy: describedByOf(id, hint, error), invalid: error !== undefined })}
				<FieldMessages id={id} error={error} />
			</div>
		</div>
	)
}

interface GroupProps {
	id: string
	label: string
	hint: string | undefined
	error: string | undefined
	children: ReactNode
}

// DESIGN.md 9.4
export function SettingGroup({ id, label, hint, error, children }: GroupProps) {
	const labelId = `${id}-label`
	return (
		<div className={SETTING_ROW}>
			<div className={SETTING_LABEL}>
				<span id={labelId} className="text-sm leading-none font-medium">
					{label}
				</span>
				<FieldMessages id={id} hint={hint} />
			</div>
			<fieldset
				id={id}
				aria-labelledby={labelId}
				aria-describedby={describedByOf(id, hint, error)}
				className="flex min-w-0 flex-col gap-2"
			>
				{children}
				<FieldMessages id={id} error={error} />
			</fieldset>
		</div>
	)
}
