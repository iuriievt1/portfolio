import { useEffect, useState } from "react"
import { Link } from "react-router"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { SaveStatus } from "@/components/custom/save-status"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import type { DeviceGroup } from "@/features/device-groups/types/device-group.types"
import { assignDeviceToGroup } from "@/features/devices/hooks/use-devices"
import type { Device } from "@/features/devices/types/device.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { deviceGroupsPagePath } from "@/lib/routes"
import { savedAtText } from "@/lib/saved-at"
import { useSave } from "@/lib/use-save"

const texts = cs.devices.group

const GROUP_FIELD_ID = "device-group"
const NO_GROUP = ""

interface Props {
	device: Device
	groups: readonly DeviceGroup[]
	onSaved: () => void
	onDirtyChange: (dirty: boolean) => void
}

// CAP-006-R18, CAP-006-S11
export function DeviceGroupSection({ device, groups, onSaved, onDirtyChange }: Props) {
	const [baseline, setBaseline] = useState(device.group_code ?? NO_GROUP)
	const [groupCode, setGroupCode] = useState(baseline)
	const { saving, failure, savedAt, save } = useSave()
	const dirty = groupCode !== baseline
	useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

	const submit = async () => {
		const saved = await save(() => assignDeviceToGroup(device.id, { group_code: groupCode }))
		if (saved === undefined) {
			return
		}
		setBaseline(saved.group_code ?? NO_GROUP)
		setGroupCode(saved.group_code ?? NO_GROUP)
		onSaved()
	}

	if (groups.length === 0) {
		return (
			<PageSection title={texts.heading}>
				<div className="flex flex-col items-start gap-2 text-sm">
					<p className="text-muted-foreground">{texts.noGroups}</p>
					<Link to={deviceGroupsPagePath()} className="font-medium hover:underline">
						{texts.createGroup}
					</Link>
				</div>
			</PageSection>
		)
	}

	return (
		<PageSection title={texts.heading}>
			<form
				className="flex flex-col gap-4"
				onSubmit={(event) => {
					event.preventDefault()
					void submit()
				}}
			>
				{failure === undefined ? null : <Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure)}</Notice>}
				<div className="max-w-sm">
					<FormField id={GROUP_FIELD_ID} label={texts.label}>
						{(control) => (
							<NativeSelect
								id={control.id}
								value={groupCode}
								disabled={saving}
								onChange={(event) => setGroupCode(event.target.value)}
							>
								{baseline === NO_GROUP ? (
									<option value={NO_GROUP} disabled>
										{texts.choose}
									</option>
								) : null}
								{groups.map((group) => (
									<option key={group.id} value={group.code}>
										{group.name}
									</option>
								))}
							</NativeSelect>
						)}
					</FormField>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" disabled={!dirty || groupCode === NO_GROUP || saving}>
						{saving ? cs.common.saving : cs.common.save}
					</Button>
					<SaveStatus message={dirty ? undefined : savedAtText(savedAt)} />
				</div>
			</form>
		</PageSection>
	)
}
