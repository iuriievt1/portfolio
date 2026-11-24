import type { Role } from "@ansora/contracts"
import { PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import type { RoleRow } from "@/features/configuration/lib/configuration-form"
import { ROLES } from "@/features/users/constants/roles"
import cs from "@/i18n/cs.json"
import { SettingGroup } from "./SettingRow"

const texts = cs.configuration.roleMapping

const NO_ROLE = ""
const EMPTY_ROW: RoleRow = { group: "", role: NO_ROLE }

function roleOf(value: string): Role | typeof NO_ROLE {
	return ROLES.find((role) => role === value) ?? NO_ROLE
}

interface Props {
	id: string
	label: string
	hint: string | undefined
	error: string | undefined
	rows: readonly RoleRow[]
	onChange: (rows: readonly RoleRow[]) => void
}

// CAP-012-R33, CAP-003-R03
export function RoleMappingField({ id, label, hint, error, rows, onChange }: Props) {
	const invalid = error !== undefined
	const update = (index: number, row: RoleRow) => onChange(rows.map((current, at) => (at === index ? row : current)))
	return (
		<SettingGroup id={id} label={label} hint={hint} error={error}>
			{rows.length === 0 ? (
				<p className="pt-1.5 text-sm text-muted-foreground">{texts.empty}</p>
			) : (
				<div aria-hidden className="flex gap-2 text-xs text-muted-foreground">
					<span className="flex-1">{texts.group}</span>
					<span className="w-36 shrink-0">{texts.role}</span>
					<span className="w-7 shrink-0" />
				</div>
			)}
			{rows.map((row, index) => {
				const groupId = `${id}-group-${index}`
				const roleId = `${id}-role-${index}`
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: controlled rows
					<div key={index} className="flex items-center gap-2">
						<label htmlFor={groupId} className="sr-only">
							{texts.group}
						</label>
						<Input
							id={groupId}
							className="identifier min-w-0 flex-1"
							autoComplete="off"
							spellCheck={false}
							value={row.group}
							aria-invalid={invalid && row.group.trim() === ""}
							onChange={(event) => update(index, { ...row, group: event.target.value })}
						/>
						<label htmlFor={roleId} className="sr-only">
							{texts.role}
						</label>
						<div className="w-36 shrink-0">
							<NativeSelect
								id={roleId}
								value={row.role}
								aria-invalid={invalid && row.role === NO_ROLE}
								onChange={(event) => {
									update(index, { ...row, role: roleOf(event.target.value) })
								}}
							>
								<option value={NO_ROLE} disabled>
									{texts.choose}
								</option>
								{ROLES.map((role) => (
									<option key={role} value={role}>
										{cs.users.role[role]}
									</option>
								))}
							</NativeSelect>
						</div>
						<Button variant="ghost" size="icon-sm" onClick={() => onChange(rows.filter((_, at) => at !== index))}>
							<TrashIcon aria-hidden />
							<span className="sr-only">{texts.remove}</span>
						</Button>
					</div>
				)
			})}
			<div>
				<Button variant="ghost" size="sm" onClick={() => onChange([...rows, EMPTY_ROW])}>
					<PlusIcon aria-hidden />
					{texts.add}
				</Button>
			</div>
		</SettingGroup>
	)
}
