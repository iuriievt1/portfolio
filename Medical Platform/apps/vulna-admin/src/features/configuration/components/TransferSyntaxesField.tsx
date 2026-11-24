import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react"
import { flushSync } from "react-dom"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { TransferSyntaxesEdit, TransferSyntaxRow } from "@/features/configuration/lib/configuration-form"
import { transferSyntaxName } from "@/features/configuration/lib/configuration-text"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"
import { SettingGroup } from "./SettingRow"

const MOVE_UP = -1
const MOVE_DOWN = 1

interface Props {
	id: string
	label: string
	hint: string | undefined
	error: string | undefined
	edit: TransferSyntaxesEdit
	onChange: (edit: TransferSyntaxesEdit) => void
}

function moved(rows: readonly TransferSyntaxRow[], index: number, offset: number): TransferSyntaxRow[] {
	const reordered = [...rows]
	const [row] = reordered.splice(index, 1)
	if (row !== undefined) {
		reordered.splice(index + offset, 0, row)
	}
	return reordered
}

// CAP-021-R17, integrace-dicom.md 3, DESIGN.md 9.4
export function TransferSyntaxesField({ id, label, hint, error, edit, onChange }: Props) {
	const rows = edit.rows
	const update = (index: number, row: TransferSyntaxRow) =>
		onChange({ rows: rows.map((current, at) => (at === index ? row : current)) })
	const move = (index: number, offset: number, button: HTMLElement) => {
		flushSync(() => onChange({ rows: moved(rows, index, offset) }))
		button.focus()
	}
	return (
		<SettingGroup id={id} label={label} hint={hint} error={error}>
			<ol className="flex flex-col gap-2">
				{rows.map((row, index) => {
					const checkboxId = `${id}-${row.transferSyntax.replaceAll(".", "-")}`
					const name = transferSyntaxName(row.transferSyntax)
					return (
						<li key={row.transferSyntax} className="flex items-center gap-3">
							<Checkbox
								id={checkboxId}
								checked={row.isChosen}
								aria-invalid={error !== undefined}
								onCheckedChange={(checked) => update(index, { ...row, isChosen: checked })}
							/>
							<label htmlFor={checkboxId} className="flex min-w-0 flex-1 flex-col">
								<span className="text-sm">{name}</span>
								<span className="identifier text-xs text-muted-foreground">{row.transferSyntax}</span>
							</label>
							<Button
								size="icon-sm"
								variant="ghost"
								className="aria-disabled:opacity-50"
								aria-label={fillText(cs.common.moveUp, { item: name })}
								disabled={index === 0}
								focusableWhenDisabled
								onClick={(event) => move(index, MOVE_UP, event.currentTarget)}
							>
								<ArrowUpIcon aria-hidden />
							</Button>
							<Button
								size="icon-sm"
								variant="ghost"
								className="aria-disabled:opacity-50"
								aria-label={fillText(cs.common.moveDown, { item: name })}
								disabled={index === rows.length - 1}
								focusableWhenDisabled
								onClick={(event) => move(index, MOVE_DOWN, event.currentTarget)}
							>
								<ArrowDownIcon aria-hidden />
							</Button>
						</li>
					)
				})}
			</ol>
		</SettingGroup>
	)
}
