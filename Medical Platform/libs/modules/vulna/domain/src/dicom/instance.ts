import { INSTANCE_TIME_ZONE } from "../registry/day-interval"
import { dicomMomentIn } from "./date-time"
import type { SopClass } from "./sop-class"
import { uidOf } from "./uid"
import { ordinalOf } from "./value-representation"

// integrace-dicom.md 5.4
export interface DicomInstance {
	sopClassUid: SopClass
	sopInstanceUid: string
	instanceNumber: number
	instanceCreationDate: string
	instanceCreationTime: string
	acquisitionDateTime: string
	contentDate: string
	contentTime: string
}

// integrace-dicom.md 5.4, datovy-model.md 4
export interface DicomInstanceSource {
	sopInstanceUid: string
	instanceNumber: number
	acquiredAt: Date
}

// integrace-dicom.md 5.4, 5.8, NAB-368, NAB-378, CAP-023-R15
export function dicomInstanceOf(sopClassUid: SopClass, instance: DicomInstanceSource, builtAt: Date): DicomInstance {
	const created = dicomMomentIn(INSTANCE_TIME_ZONE, builtAt)
	const acquired = dicomMomentIn(INSTANCE_TIME_ZONE, instance.acquiredAt)
	return {
		sopClassUid,
		sopInstanceUid: uidOf("SOP Instance UID", instance.sopInstanceUid),
		instanceNumber: ordinalOf("Instance Number", instance.instanceNumber),
		instanceCreationDate: created.date,
		instanceCreationTime: created.time,
		acquisitionDateTime: `${acquired.date}${acquired.time}`,
		contentDate: acquired.date,
		contentTime: acquired.time,
	}
}
