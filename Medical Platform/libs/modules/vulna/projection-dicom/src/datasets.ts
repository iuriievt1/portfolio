import {
	type DicomCode,
	type DicomCommonObject,
	type DicomDocumentObject,
	type DicomEquipment,
	type DicomImageObject,
	type DicomInstance,
	type DicomPatient,
	type DicomSeries,
	type DicomStudy,
	SPECIFIC_CHARACTER_SET,
} from "@ansora/vulna-domain"
import {
	bytesElement,
	type DicomElements,
	numberElement,
	sequenceElement,
	textElement,
	textValuesElement,
} from "./elements"
import { TAG } from "./tags"

// integrace-dicom.md 5.1, 5.2, 5.3, 5.4, 5.7
function commonElementsOf(object: DicomCommonObject): DicomElements {
	return {
		[TAG.SPECIFIC_CHARACTER_SET]: textElement("CS", SPECIFIC_CHARACTER_SET),
		...patientElementsOf(object.patient),
		...studyElementsOf(object.study),
		...seriesElementsOf(object.series),
		...equipmentElementsOf(object.equipment),
		...instanceElementsOf(object.instance),
	}
}

// integrace-dicom.md 5.1
function patientElementsOf(patient: DicomPatient): DicomElements {
	return {
		[TAG.PATIENT_NAME]: textElement("PN", patient.patientName),
		[TAG.PATIENT_ID]: textElement("LO", patient.patientId),
		...(patient.issuerOfPatientId === undefined
			? {}
			: { [TAG.ISSUER_OF_PATIENT_ID]: textElement("LO", patient.issuerOfPatientId) }),
		[TAG.PATIENT_BIRTH_DATE]: textElement("DA", patient.patientBirthDate),
		[TAG.PATIENT_SEX]: textElement("CS", patient.patientSex),
	}
}

// integrace-dicom.md 5.2
function studyElementsOf(study: DicomStudy): DicomElements {
	return {
		[TAG.STUDY_INSTANCE_UID]: textElement("UI", study.studyInstanceUid),
		[TAG.STUDY_ID]: textElement("SH", study.studyId),
		[TAG.ACCESSION_NUMBER]: textElement("SH", study.accessionNumber),
		[TAG.STUDY_DATE]: textElement("DA", study.studyDate),
		[TAG.STUDY_TIME]: textElement("TM", study.studyTime),
		[TAG.REFERRING_PHYSICIAN_NAME]: textElement("PN", study.referringPhysicianName),
	}
}

// integrace-dicom.md 5.3
function seriesElementsOf(series: DicomSeries): DicomElements {
	return {
		[TAG.SERIES_INSTANCE_UID]: textElement("UI", series.seriesInstanceUid),
		[TAG.SERIES_NUMBER]: numberElement("IS", series.seriesNumber),
		[TAG.MODALITY]: textElement("CS", series.modality),
		[TAG.OPERATORS_NAME]: textElement("PN", series.operatorsName),
		[TAG.STATION_NAME]: textElement("SH", series.stationName),
	}
}

// integrace-dicom.md 5.7
function equipmentElementsOf(equipment: DicomEquipment): DicomElements {
	return {
		[TAG.MANUFACTURER]: textElement("LO", equipment.manufacturer),
		[TAG.MANUFACTURER_MODEL_NAME]: textElement("LO", equipment.manufacturerModelName),
		[TAG.SOFTWARE_VERSIONS]: textElement("LO", equipment.softwareVersions),
	}
}

// integrace-dicom.md 5.4
function instanceElementsOf(instance: DicomInstance): DicomElements {
	return {
		[TAG.SOP_CLASS_UID]: textElement("UI", instance.sopClassUid),
		[TAG.SOP_INSTANCE_UID]: textElement("UI", instance.sopInstanceUid),
		[TAG.INSTANCE_NUMBER]: numberElement("IS", instance.instanceNumber),
		[TAG.INSTANCE_CREATION_DATE]: textElement("DA", instance.instanceCreationDate),
		[TAG.INSTANCE_CREATION_TIME]: textElement("TM", instance.instanceCreationTime),
		[TAG.ACQUISITION_DATE_TIME]: textElement("DT", instance.acquisitionDateTime),
		[TAG.CONTENT_DATE]: textElement("DA", instance.contentDate),
		[TAG.CONTENT_TIME]: textElement("TM", instance.contentTime),
	}
}

// DICOM PS3.3 8.8
function codeItemOf(code: DicomCode): DicomElements {
	return {
		[TAG.CODE_VALUE]: textElement("SH", code.codeValue),
		[TAG.CODING_SCHEME_DESIGNATOR]: textElement("SH", code.codingSchemeDesignator),
		[TAG.CODE_MEANING]: textElement("LO", code.codeMeaning),
	}
}

// integrace-dicom.md 2, 5, CAP-021-R09, CAP-021-R14, CAP-021-R15, CAP-021-R34
export function imageElementsOf(object: DicomImageObject): DicomElements {
	const { wound, stream } = object
	const { pixels } = stream
	return {
		...commonElementsOf(object),
		[TAG.SERIES_DESCRIPTION]: textElement("LO", wound.seriesDescription),
		[TAG.BODY_PART_EXAMINED]: textElement("CS", wound.bodyPartExamined),
		...(wound.laterality === undefined ? {} : { [TAG.LATERALITY]: textElement("CS", wound.laterality) }),
		[TAG.ANATOMIC_REGION_SEQUENCE]: sequenceElement([
			{
				...codeItemOf(wound.anatomicRegion),
				[TAG.ANATOMIC_REGION_MODIFIER_SEQUENCE]: sequenceElement(wound.anatomicRegionModifiers.map(codeItemOf)),
			},
		]),
		[TAG.IMAGE_TYPE]: textValuesElement("CS", wound.imageType),
		...(wound.derivationDescription === undefined
			? {}
			: { [TAG.DERIVATION_DESCRIPTION]: textElement("ST", wound.derivationDescription) }),
		[TAG.IMAGE_COMMENTS]: textElement("LT", wound.imageComments),
		[TAG.TRACKING_ID]: textElement("UT", wound.trackingId),
		[TAG.TRACKING_UID]: textElement("UI", wound.trackingUid),
		[TAG.PATIENT_ORIENTATION]: textElement("CS", wound.patientOrientation),
		[TAG.ACQUISITION_CONTEXT_SEQUENCE]: sequenceElement([]),
		[TAG.BURNED_IN_ANNOTATION]: textElement("CS", wound.burnedInAnnotation),
		[TAG.SAMPLES_PER_PIXEL]: numberElement("US", pixels.samplesPerPixel),
		[TAG.PHOTOMETRIC_INTERPRETATION]: textElement("CS", pixels.photometricInterpretation),
		...(pixels.planarConfiguration === undefined
			? {}
			: { [TAG.PLANAR_CONFIGURATION]: numberElement("US", pixels.planarConfiguration) }),
		[TAG.ROWS]: numberElement("US", pixels.rows),
		[TAG.COLUMNS]: numberElement("US", pixels.columns),
		[TAG.BITS_ALLOCATED]: numberElement("US", pixels.bitsAllocated),
		[TAG.BITS_STORED]: numberElement("US", pixels.bitsStored),
		[TAG.HIGH_BIT]: numberElement("US", pixels.highBit),
		[TAG.PIXEL_REPRESENTATION]: numberElement("US", pixels.pixelRepresentation),
		[TAG.LOSSY_IMAGE_COMPRESSION]: textElement("CS", pixels.lossyImageCompression),
		[TAG.LOSSY_IMAGE_COMPRESSION_METHOD]: textElement("CS", pixels.lossyImageCompressionMethod),
		[TAG.PIXEL_DATA]: bytesElement(stream.bytes),
	}
}

// integrace-dicom.md 2, 5, 5.6, CAP-021-R10
export function documentElementsOf(object: DicomDocumentObject): DicomElements {
	const { document } = object
	return {
		...commonElementsOf(object),
		[TAG.CONVERSION_TYPE]: textElement("CS", document.conversionType),
		[TAG.BURNED_IN_ANNOTATION]: textElement("CS", document.burnedInAnnotation),
		[TAG.DOCUMENT_TITLE]: textElement("ST", document.documentTitle),
		[TAG.CONCEPT_NAME_CODE_SEQUENCE]: sequenceElement([]),
		[TAG.MIME_TYPE_OF_ENCAPSULATED_DOCUMENT]: textElement("LO", document.mimeType),
		[TAG.ENCAPSULATED_DOCUMENT]: bytesElement(document.bytes),
		[TAG.ENCAPSULATED_DOCUMENT_LENGTH]: numberElement("UL", document.bytes.length),
	}
}
