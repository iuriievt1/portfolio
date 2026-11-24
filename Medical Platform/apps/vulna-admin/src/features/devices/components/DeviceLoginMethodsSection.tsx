import { useEffect, useState } from "react"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { SaveStatus } from "@/components/custom/save-status"
import { SaveWarnings } from "@/components/custom/save-warnings"
import { Button } from "@/components/ui/button"
import { setDeviceLoginMethods } from "@/features/devices/hooks/use-devices"
import type { Device } from "@/features/devices/types/device.types"
import { LoginMethodsEditor } from "@/features/login-methods/components/LoginMethodsEditor"
import { LOGIN_METHOD_SOURCE } from "@/features/login-methods/constants/login-methods"
import { useOverrideChoices } from "@/features/login-methods/hooks/use-override-choices"
import { overridesOf, previewOf, warningsBeyondPreview } from "@/features/login-methods/lib/login-method-choices"
import type { EffectiveLoginMethod, SettingWarning } from "@/features/login-methods/types/login-methods.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { savedAtText } from "@/lib/saved-at"
import { useSave } from "@/lib/use-save"

const EDITOR_ID = "device-login-methods"

interface Props {
	device: Device
	inherited: readonly EffectiveLoginMethod[] | undefined
	onSaved: () => void
	onDirtyChange: (dirty: boolean) => void
}

// CAP-012-R02, CAP-012-R26, CAP-012-R32
export function DeviceLoginMethodsSection({ device, inherited, onSaved, onDirtyChange }: Props) {
	const draft = useOverrideChoices(device.login_methods)
	const { saving, failure, savedAt, save } = useSave()
	const [warnings, setWarnings] = useState<readonly SettingWarning[]>([])
	const preview = inherited === undefined ? undefined : previewOf(draft.choices, inherited, LOGIN_METHOD_SOURCE.DEVICE)
	useEffect(() => onDirtyChange(draft.changed), [draft.changed, onDirtyChange])

	const submit = async () => {
		const result = await save(() => setDeviceLoginMethods(device.id, overridesOf(draft.choices)))
		if (result === undefined) {
			return
		}
		draft.accept(result.login_methods)
		setWarnings(result.warnings)
		onSaved()
	}

	return (
		<PageSection title={cs.loginMethods.heading}>
			<div className="flex flex-col gap-4">
				{failure === undefined ? null : <Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure)}</Notice>}
				<LoginMethodsEditor
					idPrefix={EDITOR_ID}
					level={LOGIN_METHOD_SOURCE.DEVICE}
					inheritedFrom={
						device.group_code === null || device.group_code === undefined
							? LOGIN_METHOD_SOURCE.INSTALLATION
							: LOGIN_METHOD_SOURCE.GROUP
					}
					choices={draft.choices}
					inherited={inherited}
					disabled={saving}
					onChange={draft.change}
				/>
				{savedAt === undefined || draft.changed ? null : (
					<SaveWarnings messages={warningsBeyondPreview(warnings, preview)} />
				)}
				<div className="flex flex-wrap items-center gap-3">
					<Button onClick={() => void submit()} disabled={!draft.changed || saving}>
						{saving ? cs.common.saving : cs.common.save}
					</Button>
					<SaveStatus message={draft.changed ? undefined : savedAtText(savedAt)} />
				</div>
				<p className="text-xs text-muted-foreground">{cs.loginMethods.nextContact}</p>
			</div>
		</PageSection>
	)
}
