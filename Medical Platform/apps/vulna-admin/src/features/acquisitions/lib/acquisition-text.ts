import type { AdministeredAcquisitionState, DeliveryInstanceState } from "@ansora/contracts"
import type { AdministeredAcquisition } from "@/features/acquisitions/types/acquisition.types"
import cs from "@/i18n/cs.json"
import { fillText, formatCount, formatDateTime } from "@/lib/format"

const texts = cs.acquisitions

const KIND_LABEL: Readonly<Record<NonNullable<AdministeredAcquisition["kind"]>, string>> = texts.kind
const STATE_LABEL: Readonly<Record<AdministeredAcquisitionState, string>> = texts.state
const PACS_STATUS_LABEL: Readonly<Record<DeliveryInstanceState, string>> = texts.pacsStatus

export function kindText(kind: AdministeredAcquisition["kind"]): string {
	return kind === undefined ? cs.common.notStated : KIND_LABEL[kind]
}

export function stateText(state: AdministeredAcquisitionState): string {
	return STATE_LABEL[state]
}

export function pacsStatusText(status: DeliveryInstanceState): string {
	return PACS_STATUS_LABEL[status]
}

// CAP-013-R09
export function patientText(acquisition: AdministeredAcquisition): string {
	return acquisition.patient_identifiers[0]?.value ?? cs.common.notStated
}

// CAP-012-R19
export function configurationVersionText(acquisition: AdministeredAcquisition): string {
	const version = acquisition.configuration_version
	if (version === undefined) {
		return cs.common.notStated
	}
	return fillText(texts.detail.configurationValue, {
		version: String(version.version),
		time: formatDateTime(version.created_at),
		reason: version.reason,
	})
}

export function fileCountText(acquisition: AdministeredAcquisition): string {
	return acquisition.file_count === undefined ? cs.common.notStated : formatCount(acquisition.file_count)
}

export function startedAtText(acquisition: AdministeredAcquisition): string {
	return acquisition.started_at === undefined ? cs.common.notStated : formatDateTime(acquisition.started_at)
}

export function closedAtText(acquisition: AdministeredAcquisition): string {
	const closedAt = acquisition.closed_at ?? undefined
	return closedAt === undefined ? texts.notClosed : formatDateTime(closedAt)
}
