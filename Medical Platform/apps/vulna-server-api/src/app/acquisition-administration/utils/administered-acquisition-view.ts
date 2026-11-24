import { isDeliveryInstanceState } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { patientViewOf } from "../../registry/utils/patient-view"
import type {
	AcquisitionInstanceRow,
	AcquisitionInstanceView,
	AdministeredAcquisitionContext,
	AdministeredAcquisitionRow,
	AdministeredAcquisitionView,
} from "../types/acquisition-administration.types"

const NO_FILES = 0

// administration.yaml AcquisitionDetail.file_count, CAP-021-R25
export function fileCountOf(row: AdministeredAcquisitionRow, receivedFileCounts: ReadonlyMap<string, number>): number {
	if (row.state === ACQUISITION_STATE.DRAFT) {
		return receivedFileCounts.get(row.id) ?? NO_FILES
	}
	if (row.file_count === null) {
		throw new Error(`the closed acquisition ${row.id} has no announced file count`)
	}
	return row.file_count
}

// datovy-model.md 4, NAB-313
function instanceViewOf(row: AcquisitionInstanceRow): AcquisitionInstanceView {
	const view: AcquisitionInstanceView = { sop_instance_uid: row.sop_instance_uid, sop_class: row.sop_class_uid }
	if (isDeliveryInstanceState(row.delivery_state)) {
		view.pacs_status = row.delivery_state
	}
	return view
}

// administration.yaml AcquisitionDetail, CAP-004-R10, CAP-012-R19, CAP-021-R13
export function administeredAcquisitionViewOf(
	row: AdministeredAcquisitionRow,
	context: AdministeredAcquisitionContext,
): AdministeredAcquisitionView {
	const view: AdministeredAcquisitionView = {
		id: row.id,
		kind: row.kind,
		state: row.state,
		file_count: context.fileCount,
		configuration_version: {
			version: row.configuration_version,
			created_at: row.configuration_created_at.toISOString(),
			author_user_id: row.configuration_author_user_id,
			reason: row.configuration_reason,
		},
		operator_user_id: row.operator_user_id,
		started_at: row.started_at.toISOString(),
		closed_at: row.closed_at?.toISOString() ?? null,
		patient_identifiers: patientViewOf(context.patient).identifiers,
		study_instance_uid: row.study_instance_uid,
	}
	if (row.closing_device_id !== null) {
		view.device_id = row.closing_device_id
	}
	if (row.series_instance_uid !== null) {
		view.series_instance_uid = row.series_instance_uid
	}
	if (context.instances !== undefined) {
		view.instance = context.instances.map(instanceViewOf)
	}
	return view
}
