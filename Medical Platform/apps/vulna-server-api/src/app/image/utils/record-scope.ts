import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import type { Viewer } from "../../acquisition/types/acquisition.types"
import type { RecordScope } from "../types/image.types"

// CAP-015-R17, CAP-015-R30, CAP-020-R04, CAP-003-R01
export function isRecordVisibleTo(record: RecordScope, viewer: Viewer): boolean {
	if (record.state === ACQUISITION_STATE.DRAFT) {
		return record.operator_user_id === viewer.userId
	}
	return viewer.departmentId !== undefined && record.department_id === viewer.departmentId
}
