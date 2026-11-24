import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { DetailFields } from "@/components/custom/detail-fields"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { SaveStatus } from "@/components/custom/save-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateDeviceGroup } from "@/features/device-groups/hooks/use-device-groups"
import {
	type DeviceGroupDetailsValues,
	deviceGroupDetailsSchema,
} from "@/features/device-groups/lib/device-group.schema"
import type { DeviceGroup } from "@/features/device-groups/types/device-group.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { formatCount } from "@/lib/format"
import { savedAtText } from "@/lib/saved-at"

const texts = cs.deviceGroups.details

const NAME_FIELD_ID = "group-name"

interface Props {
	group: DeviceGroup
	onSaved: () => void
	onDirtyChange: (dirty: boolean) => void
}

// CAP-006-R18
export function GroupDetailsSection({ group, onSaved, onDirtyChange }: Props) {
	const [failure, setFailure] = useState<unknown>(undefined)
	const [savedAt, setSavedAt] = useState<string | undefined>(undefined)
	const form = useForm<DeviceGroupDetailsValues>({
		resolver: zodResolver(deviceGroupDetailsSchema),
		defaultValues: { name: group.name },
	})
	const dirty = form.formState.isDirty
	useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		try {
			const saved = await updateDeviceGroup(group.id, { code: group.code, name: values.name })
			form.reset({ name: saved.name })
			setSavedAt(new Date().toISOString())
			onSaved()
		} catch (error) {
			setFailure(error)
		}
	})

	return (
		<PageSection title={texts.heading}>
			<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
				{failure === undefined ? null : <Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure)}</Notice>}
				<DetailFields
					fields={[
						{ term: cs.deviceGroups.form.codeLabel, value: <span className="identifier break-all">{group.code}</span> },
						{ term: texts.devices, value: formatCount(group.device_count ?? 0) },
					]}
				/>
				<p className="text-xs text-muted-foreground">{texts.codeHint}</p>
				<div className="max-w-sm">
					<FormField
						id={NAME_FIELD_ID}
						label={cs.deviceGroups.form.nameLabel}
						error={form.formState.errors.name?.message}
					>
						{(control) => (
							<Input
								id={control.id}
								autoComplete="off"
								aria-invalid={control.invalid}
								aria-describedby={control.describedBy}
								{...form.register("name")}
							/>
						)}
					</FormField>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" disabled={!dirty || form.formState.isSubmitting}>
						{form.formState.isSubmitting ? cs.common.saving : cs.common.save}
					</Button>
					<SaveStatus message={dirty ? undefined : savedAtText(savedAt)} />
				</div>
			</form>
		</PageSection>
	)
}
