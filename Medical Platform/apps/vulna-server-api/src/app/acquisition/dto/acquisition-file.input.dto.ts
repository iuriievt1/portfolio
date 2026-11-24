import { HPKE_SUITE, isKeyVersion } from "@ansora/core-server"
import { EDIT_KIND, type EditKind } from "@ansora/vulna-domain"
import { z } from "zod"
import { FILE_KIND } from "../constants/acquisition-file.constants"
import type { FileKind } from "../types/acquisition-file.types"

const SHA_256_PATTERN = /^[0-9a-f]{64}$/
const SEQUENCE_TEXT_PATTERN = /^[1-9][0-9]{0,8}$/
const ENVELOPE_ENC_PATTERN = /^[A-Za-z0-9_-]+$/
const ENVELOPE_ENC_MAX_LENGTH = 256
const ENVELOPE_TEXT_MAX_LENGTH = 1024
const SEQUENCE_MAX = 999_999_999
const FILE_KEYS_MAX = 1000
const BOOLEAN_TEXT = ["true", "false"] as const

// index.yaml FileIdempotencyKey, clinical-workflow.yaml FileKey, CAP-021-R23
export const fileKeySchema = z.uuid()

// ADR-015
const sha256Schema = z.string().regex(SHA_256_PATTERN)

// clinical-workflow.yaml AcquisitionFileAnnouncement, CAP-015-R35, CAP-015-R36, ADR-014
export const acquisitionFileAnnouncementSchema = z.strictObject({
	file_kind: z.enum(Object.values(FILE_KIND) as [FileKind, ...FileKind[]]),
	sha256: sha256Schema,
	proposed_sequence: z.number().int().min(1).max(SEQUENCE_MAX).optional(),
	replaces_file_key: z.uuid().optional(),
})

export type AcquisitionFileAnnouncementInput = z.infer<typeof acquisitionFileAnnouncementSchema>

// clinical-workflow.yaml AcquisitionFileOrder, CAP-015-R33, CAP-018-R11
export const acquisitionFileOrderSchema = z.strictObject({
	file_keys: z
		.array(z.uuid())
		.min(1)
		.max(FILE_KEYS_MAX)
		.refine((keys) => new Set(keys).size === keys.length, { message: "file_keys repeat a key" }),
})

export type AcquisitionFileOrderInput = z.infer<typeof acquisitionFileOrderSchema>

// clinical-workflow.yaml HpkeEnvelope
const hpkeEnvelopeSchema = z.strictObject({
	enc: z.string().max(ENVELOPE_ENC_MAX_LENGTH).regex(ENVELOPE_ENC_PATTERN),
	suite: z.literal(HPKE_SUITE),
	server_key_version: z.string().refine(isKeyVersion),
})

const envelopeTextSchema = z
	.string()
	.max(ENVELOPE_TEXT_MAX_LENGTH)
	.transform((text, context) => {
		try {
			return JSON.parse(text) as unknown
		} catch {
			context.addIssue({ code: "custom", message: "the envelope is not JSON" })
			return z.NEVER
		}
	})
	.pipe(hpkeEnvelopeSchema)

// clinical-workflow.yaml ImageUpload, ADR-015
export const imageUploadFieldsSchema = z.strictObject({
	sha256: sha256Schema,
	sequence: z.string().regex(SEQUENCE_TEXT_PATTERN).transform(Number),
	encryption: envelopeTextSchema.optional(),
	thumbnail_encryption: envelopeTextSchema.optional(),
})

// clinical-workflow.yaml DocumentPageUpload, CAP-021-S09
export const pageUploadFieldsSchema = imageUploadFieldsSchema.extend({
	is_last: z.enum(BOOLEAN_TEXT).optional(),
})

// clinical-workflow.yaml AcquisitionFileReplacement, CAP-015-R34
export const fileReplacementFieldsSchema = z.strictObject({
	sha256: sha256Schema,
	edit: z.enum(Object.values(EDIT_KIND) as [EditKind, ...EditKind[]]),
	encryption: envelopeTextSchema.optional(),
	thumbnail_encryption: envelopeTextSchema.optional(),
})
