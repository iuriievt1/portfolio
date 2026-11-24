import { LOGIN_METHOD } from "@ansora/contracts"
import { StatusPill } from "@/components/custom/status-pill"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
	type LOGIN_METHOD_SOURCE,
	OVERRIDE_CHOICE,
	OVERRIDE_CHOICES,
	QUICK_LOGIN_METHODS,
} from "@/features/login-methods/constants/login-methods"
import {
	hasQuickLoginMethod,
	isOverrideChoice,
	type OverrideChoices,
	previewOf,
} from "@/features/login-methods/lib/login-method-choices"
import type {
	EffectiveLoginMethod,
	LoginMethodSource,
	QuickLoginMethod,
} from "@/features/login-methods/types/login-methods.types"
import cs from "@/i18n/cs.json"
import { QuickLoginWarning } from "./QuickLoginWarning"

const texts = cs.loginMethods

type InheritedFrom = typeof LOGIN_METHOD_SOURCE.INSTALLATION | typeof LOGIN_METHOD_SOURCE.GROUP

interface Props {
	idPrefix: string
	level: LoginMethodSource
	inheritedFrom: InheritedFrom
	choices: OverrideChoices
	inherited: readonly EffectiveLoginMethod[] | undefined
	disabled: boolean
	onChange: (choices: OverrideChoices) => void
}

// CAP-012-R02, CAP-012-R26, CAP-012-R32
export function LoginMethodsEditor({ idPrefix, level, inheritedFrom, choices, inherited, disabled, onChange }: Props) {
	const preview = inherited === undefined ? undefined : previewOf(choices, inherited, level)
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col divide-y rounded-lg border">
				<div className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
					<span className="text-sm font-medium">{texts.method[LOGIN_METHOD.OIDC]}</span>
					<span className="text-xs text-muted-foreground">{texts.alwaysOn}</span>
				</div>
				{QUICK_LOGIN_METHODS.map((method) => (
					<MethodRow
						key={method}
						id={`${idPrefix}-${method}`}
						method={method}
						inheritedFrom={inheritedFrom}
						choices={choices}
						effective={preview?.find((entry) => entry.method === method)}
						disabled={disabled}
						onChange={onChange}
					/>
				))}
			</div>
			{preview === undefined || hasQuickLoginMethod(preview) ? null : <QuickLoginWarning />}
		</div>
	)
}

interface MethodRowProps {
	id: string
	method: QuickLoginMethod
	inheritedFrom: InheritedFrom
	choices: OverrideChoices
	effective: EffectiveLoginMethod | undefined
	disabled: boolean
	onChange: (choices: OverrideChoices) => void
}

function MethodRow({ id, method, inheritedFrom, choices, effective, disabled, onChange }: MethodRowProps) {
	const labelId = `${id}-label`
	return (
		<div className="flex flex-col gap-2 px-3 py-2.5 md:flex-row md:items-center md:justify-between md:gap-4">
			<span id={labelId} className="text-sm font-medium md:w-40">
				{texts.method[method]}
			</span>
			<RadioGroup
				aria-labelledby={labelId}
				value={choices[method]}
				disabled={disabled}
				onValueChange={(value) => {
					if (isOverrideChoice(value)) {
						onChange({ ...choices, [method]: value })
					}
				}}
				className="flex flex-wrap gap-x-4 gap-y-2 md:flex-1"
			>
				{OVERRIDE_CHOICES.map((choice) => (
					<div key={choice} className="flex items-center gap-2">
						<RadioGroupItem id={`${id}-${choice}`} value={choice} />
						<label htmlFor={`${id}-${choice}`} className="text-sm">
							{choice === OVERRIDE_CHOICE.INHERIT ? texts.inherit[inheritedFrom] : texts.choice[choice]}
						</label>
					</div>
				))}
			</RadioGroup>
			<EffectiveValue effective={effective} />
		</div>
	)
}

function EffectiveValue({ effective }: { effective: EffectiveLoginMethod | undefined }) {
	if (effective === undefined) {
		return <span className="text-xs text-muted-foreground md:w-56">{cs.common.loading}</span>
	}
	return (
		<span className="flex items-center gap-1.5 text-xs text-muted-foreground md:w-56">
			<span className="sr-only">{texts.effective.label}</span>
			{effective.enabled ? <StatusPill>{texts.effective.enabled}</StatusPill> : <span>{texts.effective.disabled}</span>}
			<span>{texts.source[effective.source]}</span>
		</span>
	)
}
