import { CARRIER_STATE } from "@ansora/contracts"
import { IdentificationCardIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import { DataTable, HIDE_BELOW } from "@/components/custom/data-table"
import { EmptyState } from "@/components/custom/empty-state"
import { LoadFailure } from "@/components/custom/load-failure"
import { RevokeAction } from "@/components/custom/revoke-action"
import { StatusPill } from "@/components/custom/status-pill"
import { TableSkeleton } from "@/components/custom/table-skeleton"
import { CARD_STATE_TONE } from "@/features/users/constants/state-tones"
import { revokeCard } from "@/features/users/hooks/use-user"
import type { Card } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { fillText, formatDateTime } from "@/lib/format"
import { REVOKE_DIALOG_TEXTS } from "@/lib/revoke-dialog-texts"
import type { RequestState } from "@/lib/use-request"

const texts = cs.user.cards

const SKELETON_ROWS = 2

const COLUMNS: ColumnDef<Card>[] = [
	{
		id: "uid",
		header: texts.columns.uid,
		cell: ({ row }) => <span className="identifier">{row.original.short_uid}</span>,
	},
	{
		id: "since",
		header: texts.columns.since,
		meta: { hideBelow: HIDE_BELOW.SM },
		cell: ({ row }) =>
			row.original.created_at === undefined ? cs.common.notStated : formatDateTime(row.original.created_at),
	},
	{
		id: "state",
		header: texts.columns.state,
		cell: ({ row }) => (
			<StatusPill tone={CARD_STATE_TONE[row.original.state]}>{texts.state[row.original.state]}</StatusPill>
		),
	},
]

// CAP-005-R03
function revocationColumn(onRevoked: () => void): ColumnDef<Card> {
	return {
		id: "actions",
		header: () => <span className="sr-only">{texts.columns.actions}</span>,
		cell: ({ row }) =>
			row.original.state === CARRIER_STATE.VALID ? (
				<RevokeAction
					{...REVOKE_DIALOG_TEXTS}
					label={cs.common.revoke}
					accessibleLabel={fillText(texts.revokeLabel, { uid: row.original.short_uid })}
					heading={fillText(texts.revokeHeading, { uid: row.original.short_uid })}
					body={texts.revokeBody}
					revoke={() => revokeCard(row.original.id)}
					onRevoked={onRevoked}
				/>
			) : null,
	}
}

function columnsOf(onRevoked: () => void): ColumnDef<Card>[] {
	return [...COLUMNS, revocationColumn(onRevoked)]
}

interface Props {
	cards: RequestState<Card[]>
	limit?: number
}

export function CardsTable({ cards, limit }: Props) {
	const columns = useMemo(() => columnsOf(cards.reload), [cards.reload])
	if (cards.data === undefined) {
		if (cards.error === undefined) {
			return <TableSkeleton columns={columns.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		return <LoadFailure title={errorMessageOf(cards.error)} retryLabel={cs.errors.retry} onRetry={cards.reload} />
	}
	if (cards.data.length === 0) {
		return <EmptyState icon={<IdentificationCardIcon weight="bold" className="size-5" />} title={texts.empty} />
	}
	return (
		<DataTable
			columns={columns}
			data={limit === undefined ? cards.data : cards.data.slice(0, limit)}
			label={texts.tableLabel}
			emptyLabel={texts.empty}
			rowId={(card) => card.id}
		/>
	)
}
