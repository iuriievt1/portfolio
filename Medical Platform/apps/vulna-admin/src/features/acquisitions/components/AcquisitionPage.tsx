import { FileDashedIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useParams } from "react-router"
import { DataTable } from "@/components/custom/data-table"
import { DetailFields } from "@/components/custom/detail-fields"
import { EmptyState } from "@/components/custom/empty-state"
import { PagePending } from "@/components/custom/page-pending"
import { PageSection, PageSections } from "@/components/custom/page-section"
import { RowLink } from "@/components/custom/row-link"
import { StatusPill } from "@/components/custom/status-pill"
import { ACQUISITION_STATE_TONE, PACS_STATUS_TONE } from "@/features/acquisitions/constants/acquisition-tone"
import { useAcquisition } from "@/features/acquisitions/hooks/use-acquisitions"
import {
	closedAtText,
	configurationVersionText,
	fileCountText,
	kindText,
	pacsStatusText,
	startedAtText,
	stateText,
} from "@/features/acquisitions/lib/acquisition-text"
import type {
	AcquisitionInstance,
	AdministeredAcquisition,
	PatientIdentifier,
} from "@/features/acquisitions/types/acquisition.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { fillText } from "@/lib/format"
import { requestFailure } from "@/lib/request-failure"
import { acquisitionsPagePath, devicePagePath, userPagePath } from "@/lib/routes"

const texts = cs.acquisitions
const detailTexts = texts.detail

const ACQUISITIONS_CRUMB = { to: acquisitionsPagePath(), label: texts.heading }

// CAP-023-R09, NAB-313
const INSTANCE_COLUMNS: ColumnDef<AcquisitionInstance>[] = [
	{
		id: "sop_instance_uid",
		header: detailTexts.sopInstanceUid,
		cell: ({ row }) => <Uid value={row.original.sop_instance_uid} />,
	},
	{
		id: "sop_class",
		header: detailTexts.sopClass,
		cell: ({ row }) =>
			row.original.sop_class === undefined ? cs.common.notStated : <Uid value={row.original.sop_class} />,
	},
	{
		id: "pacs_status",
		header: detailTexts.pacsStatus,
		cell: ({ row }) => <PacsStatus status={row.original.pacs_status} />,
	},
]

// CAP-004-R10, CAP-004-S02, DESIGN.md 9.3
export function AcquisitionPage() {
	const { acquisitionId = "" } = useParams()
	const acquisition = useAcquisition(acquisitionId)
	useShellTitle(acquisition.data === undefined ? texts.heading : titleOf(acquisition.data), ACQUISITIONS_CRUMB)

	if (acquisition.data === undefined) {
		return (
			<PagePending
				failure={requestFailure(acquisition.error)}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onRetry={acquisition.reload}
			/>
		)
	}

	return (
		<PageSections narrow>
			<PageSection title={detailTexts.acquisition}>
				<DetailFields fields={detailsOf(acquisition.data)} />
			</PageSection>
			<PageSection title={detailTexts.instances} flush>
				<Instances instances={acquisition.data.instance ?? []} />
			</PageSection>
			<PageSection title={detailTexts.identifiers} description={detailTexts.identifiersHint}>
				<DetailFields fields={identifiersOf(acquisition.data)} />
			</PageSection>
		</PageSections>
	)
}

function Instances({ instances }: { instances: readonly AcquisitionInstance[] }) {
	if (instances.length === 0) {
		return (
			<EmptyState
				icon={<FileDashedIcon weight="bold" className="size-5" />}
				title={detailTexts.instancesEmpty}
				description={detailTexts.instancesEmptyHint}
			/>
		)
	}
	return (
		<DataTable
			columns={INSTANCE_COLUMNS}
			data={[...instances]}
			label={detailTexts.instancesTable}
			emptyLabel={detailTexts.instancesEmpty}
			rowId={(instance) => instance.sop_instance_uid}
		/>
	)
}

function PacsStatus({ status }: { status: AcquisitionInstance["pacs_status"] }) {
	if (status === undefined) {
		return cs.common.notStated
	}
	return <StatusPill tone={PACS_STATUS_TONE[status]}>{pacsStatusText(status)}</StatusPill>
}

function Uid({ value }: { value: string }) {
	return <span className="identifier select-all break-all">{value}</span>
}

function AssignedUid({ value }: { value: string | undefined }) {
	return value === undefined ? detailTexts.notAssigned : <Uid value={value} />
}

function PatientIdentifierValue({ identifier }: { identifier: PatientIdentifier }) {
	return (
		<span className="flex flex-col">
			<Uid value={identifier.value} />
			<span className="identifier break-all text-xs text-muted-foreground">{identifier.system}</span>
			{identifier.issuer === undefined ? null : (
				<span className="text-xs text-muted-foreground">
					{fillText(detailTexts.issuer, { issuer: identifier.issuer })}
				</span>
			)}
		</span>
	)
}

function titleOf(acquisition: AdministeredAcquisition): string {
	return fillText(detailTexts.title, { kind: kindText(acquisition.kind), time: startedAtText(acquisition) })
}

// CAP-004-R10, administrace-model-a-api.md 7
function identifiersOf(acquisition: AdministeredAcquisition) {
	return [
		{ term: detailTexts.studyInstanceUid, value: <AssignedUid value={acquisition.study_instance_uid} /> },
		{ term: detailTexts.seriesInstanceUid, value: <AssignedUid value={acquisition.series_instance_uid} /> },
		{
			term: detailTexts.patientIdentifiers,
			value:
				acquisition.patient_identifiers.length === 0 ? (
					cs.common.notStated
				) : (
					<span className="flex flex-col gap-2">
						{acquisition.patient_identifiers.map((identifier) => (
							<PatientIdentifierValue key={`${identifier.system}|${identifier.value}`} identifier={identifier} />
						))}
					</span>
				),
		},
	]
}

// CAP-012-R19, CAP-021-R13, administrace-model-a-api.md 7
function detailsOf(acquisition: AdministeredAcquisition) {
	return [
		{ term: texts.columns.kind, value: kindText(acquisition.kind) },
		{
			term: texts.columns.state,
			value: <StatusPill tone={ACQUISITION_STATE_TONE[acquisition.state]}>{stateText(acquisition.state)}</StatusPill>,
		},
		{ term: texts.columns.files, value: fileCountText(acquisition) },
		{ term: texts.columns.startedAt, value: startedAtText(acquisition) },
		{ term: texts.columns.closedAt, value: closedAtText(acquisition) },
		{
			term: detailTexts.operator,
			value:
				acquisition.operator_user_id === undefined ? (
					cs.common.notStated
				) : (
					<RowLink to={userPagePath(acquisition.operator_user_id)}>{detailTexts.openOperator}</RowLink>
				),
		},
		{
			term: detailTexts.device,
			value:
				acquisition.device_id === undefined ? (
					cs.common.notStated
				) : (
					<RowLink to={devicePagePath(acquisition.device_id)}>{detailTexts.openDevice}</RowLink>
				),
		},
		{ term: detailTexts.configuration, value: configurationVersionText(acquisition) },
	]
}
