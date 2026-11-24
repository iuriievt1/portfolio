import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { errorCodeOf } from "@/api/client"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createDeviceGroup } from "@/features/device-groups/hooks/use-device-groups"
import { type NewDeviceGroupValues, newDeviceGroupSchema } from "@/features/device-groups/lib/device-group.schema"
import type { DeviceGroup } from "@/features/device-groups/types/device-group.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"

const texts = cs.deviceGroups.create

const CODE_FIELD_ID = "new-group-code"
const NAME_FIELD_ID = "new-group-name"

// DESIGN.md 9.5
export function NewDeviceGroupDialog({ onCreated }: { onCreated: (group: DeviceGroup) => void }) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<Button size="sm" onClick={() => setOpen(true)}>
				<PlusIcon aria-hidden />
				{texts.action}
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent closeLabel={cs.common.close}>
					<DialogHeader>
						<DialogTitle>{texts.heading}</DialogTitle>
					</DialogHeader>
					<NewDeviceGroupForm
						onCreated={(group) => {
							setOpen(false)
							onCreated(group)
						}}
					/>
				</DialogContent>
			</Dialog>
		</>
	)
}

function NewDeviceGroupForm({ onCreated }: { onCreated: (group: DeviceGroup) => void }) {
	const [failure, setFailure] = useState<unknown>(undefined)
	const form = useForm<NewDeviceGroupValues>({
		resolver: zodResolver(newDeviceGroupSchema),
		defaultValues: { code: "", name: "" },
	})
	const errors = form.formState.errors

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		try {
			onCreated(await createDeviceGroup(values))
		} catch (error) {
			if (errorCodeOf(error) === ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE) {
				form.setError("code", { message: texts.codeTaken })
				return
			}
			setFailure(error)
		}
	})

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			{failure === undefined ? null : <Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure)}</Notice>}
			<FormField id={NAME_FIELD_ID} label={cs.deviceGroups.form.nameLabel} error={errors.name?.message}>
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
			<FormField
				id={CODE_FIELD_ID}
				label={cs.deviceGroups.form.codeLabel}
				hint={texts.codeHint}
				error={errors.code?.message}
			>
				{(control) => (
					<Input
						id={control.id}
						className="identifier"
						autoComplete="off"
						spellCheck={false}
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						{...form.register("code")}
					/>
				)}
			</FormField>
			<DialogFooter>
				<DialogClose render={<Button variant="outline" />}>{cs.common.cancel}</DialogClose>
				<Button type="submit" disabled={form.formState.isSubmitting}>
					{form.formState.isSubmitting ? texts.submitting : texts.submit}
				</Button>
			</DialogFooter>
		</form>
	)
}
