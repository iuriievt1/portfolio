import { useEffect, useState } from "react"
import { describedByOf, FieldMessages } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { SaveStatus } from "@/components/custom/save-status"
import { SaveWarnings } from "@/components/custom/save-warnings"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { applyGroupLoginMethods } from "@/features/device-groups/hooks/use-device-groups"
import type { DeviceGroup, DeviceGroupSaveResult } from "@/features/device-groups/types/device-group.types"
import { LoginMethodsEditor } from "@/features/login-methods/components/LoginMethodsEditor"
import { LOGIN_METHOD_SOURCE } from "@/features/login-methods/constants/login-methods"
import { useOverrideChoices } from "@/features/login-methods/hooks/use-override-choices"
import { overridesOf, previewOf, warningsBeyondPreview } from "@/features/login-methods/lib/login-method-choices"
import type { EffectiveLoginMethod } from "@/features/login-methods/types/login-methods.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { fillText, formatCount } from "@/lib/format"
import { savedAtText } from "@/lib/saved-at"
import { useSave } from "@/lib/use-save"

const texts = cs.deviceGroups.loginMethods

const EDITOR_ID = "group-login-methods"
const CLEAR_FIELD_ID = "group-clear-device-overrides"

interface Props {
	group: DeviceGroup
	inherited: readonly EffectiveLoginMethod[] | undefined
	onSaved: () => void
	onDirtyChange: (dirty: boolean) => void
}

// CAP-012-R02, CAP-012-R26, CAP-012-R32
export function GroupLoginMethodsSection({ group, inherited, onSaved, onDirtyChange }: Props) {
	const draft = useOverrideChoices(group.login_methods ?? {})
	const { saving, failure, savedAt, save } = useSave()
	const [clearDevices, setClearDevices] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const [saved, setSaved] = useState<DeviceGroupSaveResult | undefined>(undefined)
	const dirty = draft.changed || clearDevices
	const preview = inherited === undefined ? undefined : previewOf(draft.choices, inherited, LOGIN_METHOD_SOURCE.GROUP)
	useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

	const apply = async () => {
		setConfirming(false)
		const result = await save(() =>
			applyGroupLoginMethods(group.id, {
				login_methods: overridesOf(draft.choices),
				clear_device_overrides: clearDevices,
			}),
		)
		if (result === undefined) {
			return
		}
		draft.accept(result.login_methods ?? {})
		setClearDevices(false)
		setSaved(result)
		onSaved()
	}

	const submit = () => {
		if (clearDevices) {
			setConfirming(true)
			return
		}
		void apply()
	}

	return (
		<PageSection title={cs.loginMethods.heading} description={texts.description}>
			<div className="flex flex-col gap-4">
				{failure === undefined ? null : <Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure)}</Notice>}
				<LoginMethodsEditor
					idPrefix={EDITOR_ID}
					level={LOGIN_METHOD_SOURCE.GROUP}
					inheritedFrom={LOGIN_METHOD_SOURCE.INSTALLATION}
					choices={draft.choices}
					inherited={inherited}
					disabled={saving}
					onChange={draft.change}
				/>
				<div className="flex items-start gap-2">
					<Checkbox
						id={CLEAR_FIELD_ID}
						checked={clearDevices}
						disabled={saving}
						aria-describedby={describedByOf(CLEAR_FIELD_ID, texts.clearHint, undefined)}
						onCheckedChange={setClearDevices}
						className="mt-0.5"
					/>
					<div className="flex flex-col gap-1">
						<label htmlFor={CLEAR_FIELD_ID} className="text-sm font-medium">
							{texts.clearLabel}
						</label>
						<FieldMessages id={CLEAR_FIELD_ID} hint={texts.clearHint} />
					</div>
				</div>
				{saved === undefined || dirty ? null : (
					<SavedResult result={saved} warnings={warningsBeyondPreview(saved.warnings, preview)} />
				)}
				<div className="flex flex-wrap items-center gap-3">
					<Button onClick={submit} disabled={!dirty || saving}>
						{saving ? cs.common.saving : cs.common.save}
					</Button>
					<SaveStatus message={dirty ? undefined : savedAtText(savedAt)} />
				</div>
				<p className="text-xs text-muted-foreground">{cs.loginMethods.nextContact}</p>
			</div>
			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent closeLabel={cs.common.close}>
					<DialogHeader>
						<DialogTitle>{texts.confirmHeading}</DialogTitle>
						<DialogDescription>{texts.confirmBody}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" autoFocus onClick={() => setConfirming(false)}>
							{cs.common.cancel}
						</Button>
						<Button variant="destructive" onClick={() => void apply()}>
							{texts.confirmAction}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageSection>
	)
}

function SavedResult({ result, warnings }: { result: DeviceGroupSaveResult; warnings: readonly string[] }) {
	const cleared = result.cleared_device_override_count
	return (
		<div className="flex flex-col gap-2">
			<SaveWarnings messages={warnings} />
			{cleared === null || cleared === undefined ? null : (
				<p role="status" className="text-sm">
					{fillText(texts.cleared, { count: formatCount(cleared) })}
				</p>
			)}
		</div>
	)
}
