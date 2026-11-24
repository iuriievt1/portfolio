import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { errorCodeOf } from "@/api/client"
import { DetailFields } from "@/components/custom/detail-fields"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { SaveStatus } from "@/components/custom/save-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setUserDepartment } from "@/features/users/hooks/use-user"
import { type UserDepartmentValues, userDepartmentSchema } from "@/features/users/lib/user-department.schema"
import { departmentText } from "@/features/users/lib/user-text"
import type { User } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf, USER_DEPARTMENT_MESSAGES } from "@/lib/error-message"
import { savedAtText } from "@/lib/saved-at"
import { useSave } from "@/lib/use-save"

const texts = cs.user.department

const DEPARTMENT_FIELD_ID = "user-department"

interface Props {
	user: User
	onSaved: () => void
	onDirtyChange: (dirty: boolean) => void
}

// CAP-003-R07, Q-048
export function DepartmentSection({ user, onSaved, onDirtyChange }: Props) {
	return (
		<PageSection title={texts.heading} description={texts.description}>
			{user.department_from_directory ? (
				<div className="flex flex-col gap-4">
					<DetailFields
						fields={[
							{ term: texts.label, value: <span className="identifier">{departmentText(user.department)}</span> },
						]}
					/>
					<p className="text-xs text-muted-foreground">{texts.fromDirectory}</p>
				</div>
			) : (
				<DepartmentForm user={user} onSaved={onSaved} onDirtyChange={onDirtyChange} />
			)}
		</PageSection>
	)
}

function DepartmentForm({ user, onSaved, onDirtyChange }: Props) {
	const { saving, failure, savedAt, save } = useSave()
	const form = useForm<UserDepartmentValues>({
		resolver: zodResolver(userDepartmentSchema),
		defaultValues: { department: user.department ?? "" },
	})
	const dirty = form.formState.isDirty
	useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
	useEffect(() => () => onDirtyChange(false), [onDirtyChange])

	// CAP-003-R07
	const saveDepartment = async (values: UserDepartmentValues) => {
		try {
			return await setUserDepartment(user.id, values)
		} catch (error) {
			if (errorCodeOf(error) === ADMINISTRATION_ERROR_CODE.DEPARTMENT_FROM_DIRECTORY) {
				onSaved()
			}
			throw error
		}
	}

	const submit = form.handleSubmit(async (values) => {
		const saved = await save(() => saveDepartment(values))
		if (saved === undefined) {
			return
		}
		form.reset({ department: saved.department ?? "" })
		onSaved()
	})

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			{failure === undefined ? null : (
				<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, USER_DEPARTMENT_MESSAGES)}</Notice>
			)}
			<div className="max-w-sm">
				<FormField
					id={DEPARTMENT_FIELD_ID}
					label={texts.label}
					hint={texts.hint}
					error={form.formState.errors.department?.message}
				>
					{(control) => (
						<Input
							id={control.id}
							className="identifier"
							autoComplete="off"
							spellCheck={false}
							aria-invalid={control.invalid}
							aria-describedby={control.describedBy}
							{...form.register("department")}
						/>
					)}
				</FormField>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" disabled={!dirty || saving}>
					{saving ? cs.common.saving : cs.common.save}
				</Button>
				<SaveStatus message={dirty ? undefined : savedAtText(savedAt)} />
			</div>
		</form>
	)
}
