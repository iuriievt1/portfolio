import {
	BODY_VIEW,
	type BodyView,
	CLINICAL_DESCRIPTION_MAX_LENGTH,
	CLINICAL_DESCRIPTION_PATTERN,
	CODE_LIST_ITEM_CODE_MAX_LENGTH,
	CODE_LIST_SET_VERSION_MAX_LENGTH,
	DOCUMENT_TITLE_TEXT_MAX_LENGTH,
	DOCUMENT_TITLE_TEXT_PATTERN,
	LATERALITY,
	type Laterality,
} from "@ansora/contracts"
import { z } from "zod"
import { BODY_DIAGRAM_VERSION_MAX_LENGTH, BODY_REGION_CODE_MAX_LENGTH } from "../constants/acquisition.constants"

const codeListItemCode = z.string().trim().min(1).max(CODE_LIST_ITEM_CODE_MAX_LENGTH)
const codeListVersion = z.string().trim().min(1).max(CODE_LIST_SET_VERSION_MAX_LENGTH)

// clinical-workflow.yaml BodySite, CAP-016-R03, CAP-016-R04, CAP-016-R16
const bodySiteSchema = z.strictObject({
	region_code: z.string().trim().min(1).max(BODY_REGION_CODE_MAX_LENGTH),
	laterality: z.enum(Object.values(LATERALITY) as [Laterality, ...Laterality[]]).nullable(),
	view: z.enum(Object.values(BODY_VIEW) as [BodyView, ...BodyView[]]),
	x: z.number().min(0).max(1),
	y: z.number().min(0).max(1),
	body_diagram_version: z.string().trim().min(1).max(BODY_DIAGRAM_VERSION_MAX_LENGTH),
})

// clinical-workflow.yaml Assessment, CAP-017-R03, CAP-017-R04, CAP-017-R09, CAP-017-R16
const assessmentSchema = z
	.strictObject({
		healing_phase_code: codeListItemCode.optional(),
		description: z.string().max(CLINICAL_DESCRIPTION_MAX_LENGTH).regex(CLINICAL_DESCRIPTION_PATTERN).optional(),
		code_list_version: codeListVersion.optional(),
	})
	.refine(
		(assessment) => (assessment.healing_phase_code === undefined) === (assessment.code_list_version === undefined),
		{
			message: "healing_phase_code and code_list_version go together",
		},
	)
	.refine((assessment) => assessment.healing_phase_code !== undefined || assessment.description !== undefined, {
		message: "the assessment carries nothing",
	})

// clinical-workflow.yaml DocumentTitle, CAP-018-R15
const documentTitleSchema = z
	.strictObject({
		code: codeListItemCode.optional(),
		text: z.string().trim().min(1).max(DOCUMENT_TITLE_TEXT_MAX_LENGTH).regex(DOCUMENT_TITLE_TEXT_PATTERN).optional(),
		code_list_version: codeListVersion.optional(),
	})
	.refine((title) => (title.code === undefined) !== (title.text === undefined), {
		message: "document_title carries exactly one of code and text",
	})
	.refine((title) => title.code === undefined || title.code_list_version !== undefined, {
		message: "a document title code needs code_list_version",
	})

// clinical-workflow.yaml AcquisitionDraftUpdate, CAP-016-R17, CAP-015-R31, CAP-017-R02, CAP-018-R15
export const acquisitionDraftUpdateSchema = z
	.strictObject({
		finding_id: z.uuid().nullable().optional(),
		finding_key: z.uuid().optional(),
		body_site: bodySiteSchema.optional(),
		wound_type_code: codeListItemCode.optional(),
		code_list_version: codeListVersion.optional(),
		assessment: assessmentSchema.optional(),
		document_title: documentTitleSchema.optional(),
	})
	.refine((input) => input.finding_id === undefined || input.finding_key === undefined, {
		message: "finding_id and finding_key exclude each other",
	})
	.refine((input) => input.finding_key === undefined || input.body_site !== undefined, {
		message: "finding_key needs body_site",
	})
	.refine((input) => input.wound_type_code === undefined || input.code_list_version !== undefined, {
		message: "wound_type_code needs code_list_version",
	})
	.refine((input) => input.code_list_version === undefined || input.wound_type_code !== undefined, {
		message: "code_list_version belongs to wound_type_code",
	})
	.refine((input) => input.finding_id !== null || input.body_site === undefined, {
		message: "a cleared finding takes no body_site",
	})
	.refine((input) => Object.values(input).some((value) => value !== undefined), {
		message: "the update carries nothing",
	})

export type AcquisitionDraftUpdateInput = z.infer<typeof acquisitionDraftUpdateSchema>

export type DocumentTitleInput = z.infer<typeof documentTitleSchema>

// index.yaml RequestKey, CAP-021-R29
export const requestKeySchema = z.uuid()
