import { randomUUID } from "node:crypto"
import {
	CLINICAL_RECORD_FAILURE,
	type ClinicalDeliveredInstance,
	type ClinicalDelivery,
	ClinicalRecordStoreError,
} from "@ansora/vulna-domain/ports"
import { conditionalUpdateAt, urnOf } from "./bundle-entries"
import { sopClassOf } from "./dicom-identifiers"
import type {
	Bundle,
	Device,
	ImagingStudy,
	ImagingStudySeries,
	ImagingStudySeriesInstance,
	Reference,
} from "./fhir-types"
import { tokenOf } from "./identifiers"
import { acquisitionProvenanceKeyOf, PROVENANCE_ROLE, provenanceEntryOf } from "./provenance-resources"
import type { ProjectionContext } from "./resource-meta"
import { STUDY_STATUS, withCountsOf } from "./study-resources"

// datovy-model.md 13.1 vulna-provenance
const DELIVERY_CONFIRMED_EVENT = "delivery-confirmed"

// integrace-dicom.md 5.9 SOP Instance UID, SOP Class UID, Instance Number, Image Type, Derivation Description
function studyInstanceOf(instance: ClinicalDeliveredInstance, context: ProjectionContext): ImagingStudySeriesInstance {
	const resource: ImagingStudySeriesInstance = {
		uid: instance.sopInstanceUid,
		sopClass: sopClassOf(instance.sopClassUid),
		number: instance.number,
	}
	if (instance.title !== undefined) {
		resource.title = instance.title
	}
	if (instance.description !== undefined) {
		resource.extension = [{ url: context.systems.instanceDescription, valueString: instance.description }]
	}
	return resource
}

// integrace-dicom.md 5.9 Series Description
function seriesDescriptionOf(instances: readonly ClinicalDeliveredInstance[]): string | undefined {
	const [first, ...rest] = instances.map((instance) => instance.seriesDescription)
	return first !== undefined && rest.every((description) => description === first) ? first : undefined
}

function deliveredSeriesOf(
	series: ImagingStudySeries,
	instances: readonly ClinicalDeliveredInstance[],
	context: ProjectionContext,
): ImagingStudySeries {
	const { description: _previous, ...undescribed } = series
	const ordered = [...instances].sort((left, right) => left.number - right.number)
	const delivered: ImagingStudySeries = {
		...undescribed,
		numberOfInstances: ordered.length,
		instance: ordered.map((instance) => studyInstanceOf(instance, context)),
	}
	const description = seriesDescriptionOf(ordered)
	return description === undefined ? delivered : { ...delivered, description }
}

function instancesBySeriesOf(delivery: ClinicalDelivery): Map<string, ClinicalDeliveredInstance[]> {
	const bySeries = new Map<string, ClinicalDeliveredInstance[]>()
	for (const instance of delivery.instances) {
		const series = bySeries.get(instance.seriesInstanceUid)
		if (series === undefined) {
			bySeries.set(instance.seriesInstanceUid, [instance])
		} else {
			series.push(instance)
		}
	}
	return bySeries
}

// CAP-021-R28, datovy-model.md 13.1, integrace-dicom.md 5.9
function deliveredStudyOf(
	existing: ImagingStudy,
	delivery: ClinicalDelivery,
	context: ProjectionContext,
): ImagingStudy {
	const bySeries = instancesBySeriesOf(delivery)
	const known = new Set((existing.series ?? []).map((candidate) => candidate.uid))
	const unknown = [...bySeries.keys()].filter((uid) => !known.has(uid))
	if (unknown.length > 0) {
		throw new ClinicalRecordStoreError(
			CLINICAL_RECORD_FAILURE.REJECTED,
			`the study of the record ${delivery.acquisitionId} has no series ${unknown.join(", ")}`,
		)
	}
	const series = (existing.series ?? []).map((candidate) => {
		const instances = bySeries.get(candidate.uid)
		return instances === undefined ? candidate : deliveredSeriesOf(candidate, instances, context)
	})
	return withCountsOf({ ...existing, status: STUDY_STATUS.AVAILABLE, series })
}

// CAP-021-R28, backend.md 3 T4, datovy-model.md 13.1 vulna-provenance
export function deliveryBundleOf(
	existing: ImagingStudy,
	delivery: ClinicalDelivery,
	server: Reference<Device>,
	context: ProjectionContext,
): Bundle {
	const studyUrl = urnOf(randomUUID())
	return {
		resourceType: "Bundle",
		type: "transaction",
		entry: [
			conditionalUpdateAt(
				studyUrl,
				deliveredStudyOf(existing, delivery, context),
				tokenOf(context.systems.imagingStudy, delivery.study.encounterId),
			),
			provenanceEntryOf(
				{
					key: acquisitionProvenanceKeyOf(delivery.acquisitionId, DELIVERY_CONFIRMED_EVENT),
					patientId: delivery.patientId,
					targets: [studyUrl],
					recorded: delivery.confirmedAt,
					occurred: delivery.createdAt,
					agents: [{ role: PROVENANCE_ROLE.AUTHOR, who: server }],
				},
				context.systems,
			),
		],
	}
}
