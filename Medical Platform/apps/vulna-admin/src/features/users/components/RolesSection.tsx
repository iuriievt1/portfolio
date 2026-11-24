import type { Role } from "@ansora/contracts"
import { useEffect, useState } from "react"
import { DetailFields } from "@/components/custom/detail-fields"
import { describedByOf, FieldMessages } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { SaveStatus } from "@/components/custom/save-status"
import { StatusPill } from "@/components/custom/status-pill"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ROLES } from "@/features/users/constants/roles"
import { setUserRoles } from "@/features/users/hooks/use-user"
import { isManualOnly, rolesText, sameRoles } from "@/features/users/lib/user-text"
import type { User } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { savedAtText } from "@/lib/saved-at"
import { useSave } from "@/lib/use-save"

const texts = cs.user.roles

const MANUAL_ROLES_FIELD_ID = "user-manual-roles"

interface Props {
	user: User
	onSaved: () => void
	onDirtyChange: (dirty: boolean) => void
}

// CAP-003-R03, CAP-003-R12
export function RolesSection({ user, onSaved, onDirtyChange }: Props) {
	const [baseline, setBaseline] = useState<readonly Role[]>(user.manual_roles)
	const [manualRoles, setManualRoles] = useState<readonly Role[]>(user.manual_roles)
	const { saving, failure, savedAt, save } = useSave()
	const dirty = !sameRoles(manualRoles, baseline)
	useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
	useEffect(() => () => onDirtyChange(false), [onDirtyChange])

	const assign = (role: Role, assigned: boolean) =>
		setManualRoles((current) => (assigned ? [...current, role] : current.filter((held) => held !== role)))

	const submit = async () => {
		const saved = await save(() => setUserRoles(user.id, { roles: [...manualRoles] }))
		if (saved === undefined) {
			return
		}
		setBaseline(saved.manual_roles)
		setManualRoles(saved.manual_roles)
		onSaved()
	}

	return (
		<PageSection title={texts.heading} description={texts.description}>
			<form
				className="flex flex-col gap-4"
				onSubmit={(event) => {
					event.preventDefault()
					void submit()
				}}
			>
				{failure === undefined ? null : <Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure)}</Notice>}
				<DetailFields fields={[{ term: texts.fromDirectory, value: rolesText(user.group_roles) }]} />
				<fieldset
					className="flex flex-col gap-2"
					aria-describedby={describedByOf(MANUAL_ROLES_FIELD_ID, texts.manualHint, undefined)}
				>
					<legend className="label-caps mb-1 text-xs font-medium text-muted-foreground">{texts.manual}</legend>
					{ROLES.map((role) => {
						const checkboxId = `${MANUAL_ROLES_FIELD_ID}-${role}`
						return (
							<div key={role} className="flex items-center gap-2">
								<Checkbox
									id={checkboxId}
									checked={manualRoles.includes(role)}
									disabled={saving}
									onCheckedChange={(checked) => assign(role, checked)}
								/>
								<label htmlFor={checkboxId} className="flex items-center gap-2 text-sm">
									{cs.users.role[role]}
									{isManualOnly(role, user.group_roles, manualRoles) ? (
										<StatusPill>{texts.manualOnly}</StatusPill>
									) : null}
								</label>
							</div>
						)
					})}
					<FieldMessages id={MANUAL_ROLES_FIELD_ID} hint={texts.manualHint} />
				</fieldset>
				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" disabled={!dirty || saving}>
						{saving ? cs.common.saving : cs.common.save}
					</Button>
					<SaveStatus message={dirty ? undefined : savedAtText(savedAt)} />
				</div>
			</form>
		</PageSection>
	)
}
